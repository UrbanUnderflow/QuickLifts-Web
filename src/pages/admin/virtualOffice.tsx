import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { presenceService, AgentPresence, AgentThoughtStep, TaskHistoryEntry } from '../../api/firebase/presence/service';
import { kanbanService } from '../../api/firebase/kanban/service';
import { KanbanTask } from '../../api/firebase/kanban/types';
import {
  RefreshCcw, Clock, ExternalLink, CheckCircle2, Circle,
  ArrowRight, Loader2, XCircle, ChevronDown, Brain, Zap,
  History, ChevronRight
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────── */

const formatRelative = (date?: Date) => {
  if (!date) return '—';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString();
};

const formatDuration = (start?: Date) => {
  if (!start) return null;
  const diff = Date.now() - start.getTime();
  const hrs = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
};

const formatMs = (ms?: number) => {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
};

/* ─── Desk positions for the office floor plan ────────── */

const DESK_POSITIONS = [
  { x: 22, y: 42, facing: 'right' as const },
  { x: 58, y: 42, facing: 'left' as const },
  { x: 22, y: 72, facing: 'right' as const },
  { x: 58, y: 72, facing: 'left' as const },
  { x: 40, y: 26, facing: 'right' as const },
  { x: 40, y: 86, facing: 'left' as const },
];

/* ─── Agent roles / job titles ─────────────────────── */

const AGENT_ROLES: Record<string, string> = {
  antigravity: 'Co-CEO · Strategy & Architecture',
  nora: 'Lead Engineer',
  // Add more agents here as they join
};

/* ─── Status colours ──────────────────────────────────── */

const STATUS_CONFIG = {
  working: {
    label: 'Working',
    color: '#22c55e',
    glow: 'rgba(34,197,94,0.5)',
    monitorGlow: 'rgba(34,197,94,0.6)',
    badge: 'bg-green-500/15 text-green-400 border-green-500/30',
  },
  idle: {
    label: 'Idle',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.4)',
    monitorGlow: 'rgba(245,158,11,0.4)',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  offline: {
    label: 'Offline',
    color: '#52525b',
    glow: 'transparent',
    monitorGlow: 'rgba(82,82,91,0.2)',
    badge: 'bg-zinc-600/15 text-zinc-400 border-zinc-600/30',
  },
};

/* ─── Step status icon ────────────────────────────────── */

const StepIcon: React.FC<{ status: AgentThoughtStep['status'] }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />;
    case 'in-progress':
      return <Loader2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 animate-spin" />;
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
    default:
      return <Circle className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />;
  }
};

/* ─── Live Execution Steps Panel ──────────────────────── */

const ExecutionStepsPanel: React.FC<{
  steps: AgentThoughtStep[];
  currentStepIndex: number;
  taskProgress: number;
  taskName?: string;
  taskStartedAt?: Date;
}> = ({ steps, currentStepIndex, taskProgress, taskName, taskStartedAt }) => {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const stepsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active step
  useEffect(() => {
    if (stepsContainerRef.current && currentStepIndex >= 0) {
      const activeEl = stepsContainerRef.current.querySelector('.step-active');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentStepIndex]);

  if (steps.length === 0) return null;

  const completedCount = steps.filter(s => s.status === 'completed').length;
  const taskDuration = formatDuration(taskStartedAt);

  return (
    <div className="exec-steps-panel">
      {/* Task header */}
      <div className="exec-header">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
            Execution Pipeline
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          {taskDuration && <span>{taskDuration}</span>}
          <span>{completedCount}/{steps.length}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="exec-progress-track">
        <div
          className="exec-progress-fill"
          style={{ width: `${taskProgress}%` }}
        />
        {taskProgress > 0 && taskProgress < 100 && (
          <div className="exec-progress-pulse" style={{ left: `${taskProgress}%` }} />
        )}
      </div>

      {/* Steps list */}
      <div className="exec-steps-list" ref={stepsContainerRef}>
        {steps.map((step, i) => {
          const isActive = step.status === 'in-progress';
          const isExpanded = expandedStep === step.id;
          const hasDetail = step.reasoning || step.output;

          return (
            <div
              key={step.id}
              className={`exec-step ${step.status} ${isActive ? 'step-active' : ''}`}
              onClick={() => hasDetail && setExpandedStep(isExpanded ? null : step.id)}
            >
              <div className="exec-step-main">
                <div className="exec-step-connector">
                  <div className={`connector-line ${i === 0 ? 'first' : ''} ${i === steps.length - 1 ? 'last' : ''}`} />
                  <StepIcon status={step.status} />
                </div>
                <div className="exec-step-content">
                  <p className={`exec-step-desc ${step.status}`}>{step.description}</p>
                  <div className="exec-step-meta">
                    {step.durationMs ? (
                      <span className="text-zinc-600">{formatMs(step.durationMs)}</span>
                    ) : isActive ? (
                      <span className="text-blue-400/70 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" /> Processing…
                      </span>
                    ) : null}
                  </div>
                </div>
                {hasDetail && (
                  <ChevronDown className={`w-3 h-3 text-zinc-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                )}
              </div>

              {/* Expanded detail */}
              {isExpanded && hasDetail && (
                <div className="exec-step-detail">
                  {step.reasoning && (
                    <div className="thought-bubble">
                      <p className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
                        <Brain className="w-2.5 h-2.5" /> Reasoning
                      </p>
                      <p className="text-[11px] text-zinc-300">{step.reasoning}</p>
                    </div>
                  )}
                  {step.output && (
                    <div className="output-bubble">
                      <p className="text-[10px] text-zinc-500 mb-0.5">Output</p>
                      <p className="text-[11px] text-zinc-200 font-mono">{step.output}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Task History Panel ──────────────────────────────── */

const TaskHistoryPanel: React.FC<{ agentId: string }> = ({ agentId }) => {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const fetched = useRef(false);

  const loadHistory = useCallback(async () => {
    if (fetched.current) {
      setExpanded(e => !e);
      return;
    }
    setLoading(true);
    setExpanded(true);
    try {
      const entries = await presenceService.fetchTaskHistory(agentId, 10);
      setHistory(entries);
      fetched.current = true;
    } catch (err) {
      console.error('Failed to load task history:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  return (
    <div className="task-history-section">
      <button
        onClick={loadHistory}
        className="history-toggle"
      >
        <History className="w-3 h-3" />
        <span>Task History</span>
        <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="history-list">
          {loading && (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
            </div>
          )}

          {!loading && history.length === 0 && (
            <p className="text-[10px] text-zinc-600 text-center py-2">No completed tasks yet</p>
          )}

          {history.map((entry) => {
            const isEntryExpanded = expandedEntry === entry.id;
            const entryDate = entry.completedAt;
            const timeStr = entryDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';
            const dateStr = entryDate?.toLocaleDateString([], { month: 'short', day: 'numeric' }) || '';

            return (
              <div key={entry.id} className="history-entry">
                <button
                  className="history-entry-header"
                  onClick={() => setExpandedEntry(isEntryExpanded ? null : (entry.id || null))}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {entry.status === 'completed'
                      ? <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                      : <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                    <span className="text-[11px] text-zinc-200 truncate">{entry.taskName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[9px] text-zinc-600">{formatMs(entry.totalDurationMs)}</span>
                    <ChevronRight className={`w-2.5 h-2.5 text-zinc-600 transition-transform ${isEntryExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {/* Expanded: show step list */}
                {isEntryExpanded && (
                  <div className="history-entry-steps">
                    <div className="flex items-center justify-between text-[9px] text-zinc-600 mb-1.5">
                      <span>{dateStr} at {timeStr}</span>
                      <span>{entry.completedStepCount}/{entry.stepCount} steps</span>
                    </div>
                    {entry.steps.map((step, si) => (
                      <div key={step.id || si} className="history-step">
                        <StepIcon status={step.status} />
                        <span className={`text-[10px] truncate ${step.status === 'completed' ? 'text-zinc-400'
                          : step.status === 'failed' ? 'text-red-400'
                            : 'text-zinc-600'
                          }`}>
                          {step.description}
                        </span>
                        {step.durationMs ? (
                          <span className="text-[9px] text-zinc-700 ml-auto flex-shrink-0">
                            {formatMs(step.durationMs)}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ─── Agent Desk Sprite ───────────────────────────────── */

interface AgentDeskProps {
  agent: AgentPresence;
  position: { x: number; y: number; facing: 'left' | 'right' };
}

const AgentDeskSprite: React.FC<AgentDeskProps> = ({ agent, position }) => {
  const [hovered, setHovered] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const status = STATUS_CONFIG[agent.status];
  const sessionDuration = formatDuration(agent.sessionStartedAt);
  const hasSteps = agent.executionSteps && agent.executionSteps.length > 0;

  const handleMouseEnter = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => {
      setHovered(false);
      hoverTimerRef.current = null;
    }, 2000); // 2 second linger
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  return (
    <div
      className="agent-desk-sprite"
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Status halo / glow under the desk */}
      <div className="desk-glow" style={{ boxShadow: `0 0 40px 15px ${status.glow}` }} />

      {/* The desk surface */}
      <div className="office-desk">
        <div className="desk-surface" />
        <div className="desk-leg left" />
        <div className="desk-leg right" />
      </div>

      {/* Monitor */}
      <div className="agent-monitor" style={{ boxShadow: `0 0 20px ${status.monitorGlow}` }}>
        <div className="monitor-screen" style={{ background: agent.status === 'working' ? '#0c1222' : '#0a0a0a' }}>
          {agent.status === 'working' && (
            <>
              <div className="code-line l1" />
              <div className="code-line l2" />
              <div className="code-line l3" />
              <div className="cursor-blink" />
            </>
          )}
        </div>
        <div className="monitor-stand" />
      </div>

      {/* Character */}
      <div className={`office-character ${agent.status}`}>
        <div className="char-head" />
        <div className="char-body">
          <div className="char-arm left" />
          <div className="char-arm right" />
        </div>
      </div>

      {/* Chair */}
      <div className="office-chair" />

      {/* Nameplate + role + progress */}
      <div className="agent-nameplate">
        <span className={`status-dot ${agent.status}`} />
        <div className="nameplate-text">
          <span className="agent-name">{agent.displayName}</span>
          {AGENT_ROLES[agent.id] && (
            <span className="agent-role">{AGENT_ROLES[agent.id]}</span>
          )}
        </div>
        {hasSteps && agent.taskProgress > 0 && (
          <span className="name-progress">{agent.taskProgress}%</span>
        )}
      </div>

      {/* Hover Panel: Info + Live Execution Steps */}
      {hovered && (
        <div className={`hover-detail-panel ${position.facing}`}>
          {/* Agent info header */}
          <div className="detail-header">
            <div className="flex items-center gap-2">
              <span className="text-base">{agent.emoji || '⚡️'}</span>
              <span className="text-white font-semibold text-sm">{agent.displayName}</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status.badge}`}>
              {status.label}
            </span>
          </div>

          {/* Current task */}
          {agent.currentTask && (
            <div className="detail-task">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Current Task</p>
              <p className="text-xs text-zinc-100 mt-0.5 font-medium">{agent.currentTask}</p>
            </div>
          )}

          {/* Live Execution Steps Checklist */}
          {hasSteps && (
            <ExecutionStepsPanel
              steps={agent.executionSteps}
              currentStepIndex={agent.currentStepIndex}
              taskProgress={agent.taskProgress}
              taskName={agent.currentTask}
              taskStartedAt={agent.taskStartedAt}
            />
          )}

          {/* Notes (when no steps) */}
          {!hasSteps && agent.notes && (
            <div className="detail-notes">
              <p className="text-[10px] text-zinc-500 mb-0.5">Notes</p>
              <p className="text-[11px] text-zinc-300 whitespace-pre-wrap">{agent.notes}</p>
            </div>
          )}

          {/* Task History */}
          <TaskHistoryPanel agentId={agent.id} />

          {/* Footer */}
          <div className="detail-footer">
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />{formatRelative(agent.lastUpdate)}
            </span>
            {sessionDuration && <span>Session: {sessionDuration}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Office Decorations ──────────────────────────────── */

const OfficeDecorations: React.FC = () => (
  <>
    {/* Whiteboard */}
    <div className="office-whiteboard">
      <div className="wb-frame">
        <div className="wb-surface">
          <div className="wb-text">Sprint Goals</div>
          <div className="wb-line" />
          <div className="wb-line short" />
          <div className="wb-line" />
          <div className="wb-marker red" />
          <div className="wb-marker blue" />
        </div>
      </div>
    </div>

    {/* Plants */}
    <div className="office-plant p1">
      <div className="pot" />
      <div className="plant-stem" />
      <div className="leaf l1" />
      <div className="leaf l2" />
      <div className="leaf l3" />
    </div>
    <div className="office-plant p2">
      <div className="pot" />
      <div className="plant-stem" />
      <div className="leaf l1" />
      <div className="leaf l2" />
    </div>

    {/* Water cooler */}
    <div className="water-cooler">
      <div className="cooler-tank" />
      <div className="cooler-body" />
    </div>

    {/* Wall clock */}
    <div className="wall-clock">
      <div className="clock-face">
        <div className="clock-hand hour" />
        <div className="clock-hand minute" />
        <div className="clock-center" />
      </div>
    </div>

    {/* Window */}
    <div className="office-window">
      <div className="window-pane" />
      <div className="window-divider v" />
      <div className="window-divider h" />
      <div className="window-glow" />
    </div>
  </>
);

/* ─── Live clock widget ───────────────────────────────── */

const LiveClock: React.FC = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-2 text-zinc-400 text-sm font-mono">
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      <span>LIVE</span>
      <span className="text-zinc-500">•</span>
      <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
    </div>
  );
};

/* ─── Main Virtual Office ─────────────────────────────── */

const VirtualOfficeContent: React.FC = () => {
  const [agents, setAgents] = useState<AgentPresence[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const unsubscribe = presenceService.listen((next) => {
      setAgents(next.sort((a, b) => a.displayName.localeCompare(b.displayName)));
    });
    return () => unsubscribe();
  }, [refreshKey]);

  // Inject Antigravity as a static always-online agent
  const ANTIGRAVITY_PRESENCE: AgentPresence = {
    id: 'antigravity',
    displayName: 'Antigravity',
    emoji: '🌌',
    status: 'working' as const,
    currentTask: 'Pair programming with Tremaine',
    currentTaskId: '',
    notes: 'IDE Agent — always online when the editor is open',
    executionSteps: [],
    currentStepIndex: -1,
    taskProgress: 0,
    lastUpdate: new Date(),
    sessionStartedAt: new Date(),
  };

  const allAgents = useMemo(() => {
    // Put Antigravity first, then Firestore agents
    const hasAntigravity = agents.some(a => a.id === 'antigravity');
    return hasAntigravity ? agents : [ANTIGRAVITY_PRESENCE, ...agents];
  }, [agents]);

  const workingCount = useMemo(() => allAgents.filter((a) => a.status === 'working').length, [allAgents]);
  const idleCount = useMemo(() => allAgents.filter((a) => a.status === 'idle').length, [allAgents]);

  // Overall progress across all working agents
  const overallProgress = useMemo(() => {
    const working = allAgents.filter(a => a.status === 'working' && a.executionSteps.length > 0);
    if (working.length === 0) return null;
    const avg = working.reduce((sum, a) => sum + a.taskProgress, 0) / working.length;
    return Math.round(avg);
  }, [allAgents]);

  return (
    <div className="voffice-root">
      <Head>
        <title>Virtual Office – Pulse Admin</title>
      </Head>
      <AdminRouteGuard>
        {/* ── Top bar ── */}
        <div className="voffice-topbar">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Operations</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">Virtual Office</h1>
          </div>
          <div className="flex items-center gap-4">
            <LiveClock />
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800/60 hover:border-zinc-600 transition-all"
            >
              <RefreshCcw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="voffice-stats">
          <div className="stat-chip">
            <div className="stat-dot working" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Working</p>
              <p className="text-lg font-semibold text-white">{workingCount}</p>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-dot idle" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Idle</p>
              <p className="text-lg font-semibold text-white">{idleCount}</p>
            </div>
          </div>
          <div className="stat-chip">
            <div className="stat-dot total" />
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Total</p>
              <p className="text-lg font-semibold text-white">{allAgents.length}</p>
            </div>
          </div>
          {overallProgress !== null && (
            <div className="stat-chip progress-chip">
              <Zap className="w-4 h-4 text-blue-400" />
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Progress</p>
                <p className="text-lg font-semibold text-blue-400">{overallProgress}%</p>
              </div>
            </div>
          )}
        </div>

        {/* ── The Office Floor ── */}
        <div className="office-floor-container">
          <div className="office-floor">
            <div className="floor-grid" />
            <div className="office-wall" />
            <OfficeDecorations />

            {allAgents.length === 0 && (
              <div className="empty-office">
                <div className="empty-icon">🏢</div>
                <p className="text-zinc-400 text-sm">The office is empty</p>
                <p className="text-zinc-600 text-xs mt-1">Agents will appear here when they emit a heartbeat</p>
              </div>
            )}

            {allAgents.map((agent, i) => (
              <AgentDeskSprite
                key={agent.id}
                agent={agent}
                position={DESK_POSITIONS[i % DESK_POSITIONS.length]}
              />
            ))}
          </div>
        </div>
      </AdminRouteGuard>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  STYLES                                            */}
      {/* ═══════════════════════════════════════════════════ */}
      <style jsx global>{`
        .voffice-root {
          min-height: 100vh;
          background: #030508;
          color: white;
          font-family: 'Inter', -apple-system, sans-serif;
        }

        /* ── Top bar ── */
        .voffice-topbar {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 28px 0;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
        }

        /* ── Stats ── */
        .voffice-stats {
          max-width: 1200px;
          margin: 20px auto 0;
          padding: 0 28px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .stat-chip {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(17,20,23,0.8);
          border: 1px solid rgba(63,63,70,0.3);
          border-radius: 12px;
          padding: 10px 16px;
          backdrop-filter: blur(8px);
        }
        .progress-chip {
          border-color: rgba(59,130,246,0.2);
          background: rgba(59,130,246,0.05);
        }
        .stat-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .stat-dot.working { background: #22c55e; box-shadow: 0 0 8px rgba(34,197,94,0.5); }
        .stat-dot.idle { background: #f59e0b; box-shadow: 0 0 8px rgba(245,158,11,0.4); }
        .stat-dot.total { background: #3b82f6; box-shadow: 0 0 8px rgba(59,130,246,0.4); }

        /* ── Office Floor ── */
        .office-floor-container {
          max-width: 1200px;
          margin: 24px auto 0;
          padding: 0 28px 40px;
        }
        .office-floor {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          min-height: 500px;
          border-radius: 20px;
          overflow: hidden;
          background: linear-gradient(180deg, #0d1117 0%, #0a0e14 40%, #080c11 100%);
          border: 1px solid rgba(63,63,70,0.25);
          box-shadow: 0 4px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03);
        }
        .floor-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(63,63,70,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(63,63,70,0.06) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 15%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.8) 100%);
        }
        .office-wall {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 14%;
          background: linear-gradient(180deg, #111827 0%, #0d1117 100%);
          border-bottom: 2px solid rgba(63,63,70,0.2);
        }

        /* ── Decorations ── */
        .office-whiteboard { position: absolute; top: 1.5%; left: 50%; transform: translateX(-50%); z-index: 2; }
        .wb-frame { width: 160px; height: 64px; background: #d4d4d4; border-radius: 4px; padding: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .wb-surface { width: 100%; height: 100%; background: #f5f5f5; border-radius: 2px; position: relative; overflow: hidden; padding: 6px 8px; }
        .wb-text { font-size: 6px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
        .wb-line { width: 80%; height: 2px; background: #94a3b8; border-radius: 1px; margin-bottom: 3px; opacity: 0.4; }
        .wb-line.short { width: 50%; }
        .wb-marker { position: absolute; bottom: 4px; width: 16px; height: 4px; border-radius: 2px; }
        .wb-marker.red { right: 26px; background: #ef4444; }
        .wb-marker.blue { right: 8px; background: #3b82f6; }

        .office-plant { position: absolute; z-index: 2; }
        .office-plant.p1 { bottom: 8%; right: 6%; }
        .office-plant.p2 { bottom: 8%; left: 6%; }
        .office-plant .pot { width: 24px; height: 18px; background: linear-gradient(180deg, #92400e, #78350f); border-radius: 4px 4px 6px 6px; margin: 0 auto; }
        .office-plant .plant-stem { width: 3px; height: 16px; background: #16a34a; margin: 0 auto; position: relative; top: -1px; border-radius: 2px; }
        .office-plant .leaf { position: absolute; width: 14px; height: 8px; background: #22c55e; border-radius: 50% 50% 50% 0; }
        .office-plant .leaf.l1 { top: -30px; left: 50%; transform: translateX(-50%) rotate(-20deg); }
        .office-plant .leaf.l2 { top: -24px; left: 30%; transform: rotate(30deg); }
        .office-plant .leaf.l3 { top: -26px; right: 30%; transform: rotate(-40deg) scaleX(-1); }

        .water-cooler { position: absolute; top: 15%; right: 8%; z-index: 2; }
        .cooler-tank { width: 18px; height: 22px; background: linear-gradient(180deg, rgba(147,197,253,0.3), rgba(96,165,250,0.15)); border: 1px solid rgba(147,197,253,0.2); border-radius: 6px 6px 2px 2px; margin: 0 auto; }
        .cooler-body { width: 22px; height: 28px; background: #d4d4d8; border-radius: 3px; margin: 0 auto; }

        .wall-clock { position: absolute; top: 2%; right: 18%; z-index: 2; }
        .clock-face { width: 32px; height: 32px; border-radius: 50%; background: #1e293b; border: 2px solid #334155; position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
        .clock-hand { position: absolute; bottom: 50%; left: 50%; transform-origin: bottom center; border-radius: 2px; }
        .clock-hand.hour { width: 2px; height: 8px; background: #e2e8f0; transform: translateX(-50%) rotate(30deg); }
        .clock-hand.minute { width: 1.5px; height: 11px; background: #94a3b8; animation: clockSpin 60s linear infinite; transform: translateX(-50%); }
        .clock-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 4px; height: 4px; border-radius: 50%; background: #f59e0b; }
        @keyframes clockSpin { from { transform: translateX(-50%) rotate(0deg); } to { transform: translateX(-50%) rotate(360deg); } }

        .office-window { position: absolute; top: 1%; left: 15%; width: 80px; height: 52px; z-index: 2; }
        .window-pane { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(30,58,138,0.15), rgba(15,23,42,0.3)); border: 2px solid #334155; border-radius: 4px; }
        .window-divider.v { position: absolute; top: 0; left: 50%; width: 2px; height: 100%; background: #334155; }
        .window-divider.h { position: absolute; top: 50%; left: 0; width: 100%; height: 2px; background: #334155; }
        .window-glow { position: absolute; inset: -4px; border-radius: 6px; background: radial-gradient(ellipse, rgba(96,165,250,0.04), transparent 70%); }

        /* ══════════════════════════════════════════════════ */
        /*  AGENT DESK SPRITES                               */
        /* ══════════════════════════════════════════════════ */
        .agent-desk-sprite {
          position: absolute;
          width: 120px; height: 120px;
          transform: translate(-50%, -50%);
          z-index: 5;
          cursor: pointer;
          transition: transform 0.3s ease;
        }
        .agent-desk-sprite:hover {
          transform: translate(-50%, -50%) scale(1.08);
          z-index: 20;
        }
        .desk-glow {
          position: absolute;
          bottom: 4px; left: 50%;
          transform: translateX(-50%);
          width: 80px; height: 10px;
          border-radius: 50%;
          transition: box-shadow 0.4s ease;
        }

        /* Desk */
        .office-desk { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); }
        .desk-surface { width: 90px; height: 8px; background: linear-gradient(90deg, #3f3f46, #52525b, #3f3f46); border-radius: 3px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .desk-leg { position: absolute; top: 8px; width: 4px; height: 14px; background: #27272a; border-radius: 0 0 2px 2px; }
        .desk-leg.left { left: 8px; }
        .desk-leg.right { right: 8px; }

        /* Monitor */
        .agent-monitor { position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%); width: 40px; height: 28px; border-radius: 4px; background: #18181b; border: 2px solid #27272a; transition: box-shadow 0.4s ease; z-index: 3; }
        .monitor-screen { width: calc(100% - 4px); height: calc(100% - 6px); margin: 2px; border-radius: 2px; overflow: hidden; position: relative; }
        .monitor-stand { position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%); width: 12px; height: 4px; background: #27272a; border-radius: 0 0 2px 2px; }

        .code-line { height: 2px; border-radius: 1px; margin: 3px 3px 0; opacity: 0.6; }
        .code-line.l1 { width: 60%; background: #22c55e; animation: codeFlicker 2s infinite 0s; }
        .code-line.l2 { width: 40%; background: #3b82f6; animation: codeFlicker 2s infinite 0.4s; }
        .code-line.l3 { width: 75%; background: #a855f7; animation: codeFlicker 2s infinite 0.8s; }
        .cursor-blink { position: absolute; bottom: 4px; right: 4px; width: 2px; height: 5px; background: #22c55e; animation: blink 1s step-end infinite; }
        @keyframes codeFlicker { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

        /* Character */
        .office-character { position: absolute; bottom: 36px; left: 50%; transform: translateX(calc(-50% - 16px)); display: flex; flex-direction: column; align-items: center; z-index: 2; }
        .char-head { width: 16px; height: 16px; border-radius: 50%; background: linear-gradient(180deg, #fde68a, #fbbf24); box-shadow: 0 0 6px rgba(253,230,138,0.3); }
        .char-body { width: 20px; height: 22px; margin-top: 2px; border-radius: 8px 8px 4px 4px; background: linear-gradient(180deg, #38bdf8, #0ea5e9); position: relative; overflow: visible; }
        .char-arm { position: absolute; top: 8px; width: 14px; height: 5px; background: linear-gradient(90deg, #fde68a, #fbbf24); border-radius: 999px; }
        .char-arm.right { right: -10px; transform-origin: left center; }
        .char-arm.left { left: -10px; transform-origin: right center; }

        .office-character.working .char-arm.right { animation: armType 0.6s ease-in-out infinite; }
        .office-character.working .char-arm.left { animation: armType 0.6s ease-in-out infinite 0.3s; }
        @keyframes armType { 0%, 100% { transform: rotate(-2deg) translateY(0); } 50% { transform: rotate(4deg) translateY(-1px); } }

        .office-character.idle .char-arm { animation: none; opacity: 0.7; transform: rotate(2deg); }
        .office-character.idle .char-head { animation: idleBob 3s ease-in-out infinite; }
        @keyframes idleBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(1px); } }

        .office-character.offline { opacity: 0.3; filter: grayscale(0.8); }
        .office-character.offline .char-arm { animation: none; }

        .office-chair { position: absolute; bottom: 24px; left: 50%; transform: translateX(calc(-50% - 18px)); width: 22px; height: 24px; border-radius: 8px 8px 4px 4px; background: linear-gradient(180deg, #1e293b, #0f172a); box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 1; }

        /* Nameplate */
        .agent-nameplate {
          position: absolute; bottom: -2px; left: 50%;
          transform: translateX(-50%);
          display: flex; align-items: center; gap: 4px;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(8px);
          padding: 3px 10px;
          border-radius: 10px;
          border: 1px solid rgba(63,63,70,0.3);
          white-space: nowrap; z-index: 10;
        }
        .nameplate-text {
          display: flex; flex-direction: column; align-items: center; gap: 0;
        }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; }
        .status-dot.working { background: #22c55e; animation: dotPulse 2s infinite; }
        .status-dot.idle { background: #f59e0b; }
        .status-dot.offline { background: #52525b; }
        @keyframes dotPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); } 50% { box-shadow: 0 0 0 4px rgba(34,197,94,0); } }
        .agent-name { font-size: 10px; font-weight: 600; color: #d4d4d8; letter-spacing: 0.02em; }
        .agent-role { font-size: 8px; font-weight: 500; color: #71717a; letter-spacing: 0.03em; line-height: 1; margin-top: -1px; }
        .name-progress { font-size: 9px; font-weight: 700; color: #3b82f6; margin-left: 2px; }

        /* ══════════════════════════════════════════════════ */
        /*  HOVER DETAIL PANEL                               */
        /* ══════════════════════════════════════════════════ */
        .hover-detail-panel {
          position: absolute;
          top: 50%;
          width: 300px;
          max-height: 450px;
          overflow-y: auto;
          background: rgba(8,12,17,0.97);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(63,63,70,0.35);
          border-radius: 16px;
          padding: 16px;
          z-index: 30;
          box-shadow: 0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03);
          animation: panelSlideIn 0.25s ease-out;
          scrollbar-width: thin;
          scrollbar-color: rgba(63,63,70,0.3) transparent;
        }
        .hover-detail-panel.right {
          left: calc(100% + 20px);
          transform: translateY(-50%);
        }
        .hover-detail-panel.left {
          right: calc(100% + 20px);
          transform: translateY(-50%);
        }
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateY(-50%) translateX(-8px); }
          to { opacity: 1; transform: translateY(-50%) translateX(0); }
        }

        .detail-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(63,63,70,0.2);
        }
        .detail-task {
          margin-bottom: 10px;
        }
        .detail-notes {
          background: rgba(24,24,27,0.6);
          border: 1px solid rgba(63,63,70,0.2);
          border-radius: 10px;
          padding: 8px 10px;
          margin-bottom: 10px;
        }
        .detail-footer {
          display: flex; justify-content: space-between;
          font-size: 10px; color: #71717a;
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid rgba(63,63,70,0.15);
        }

        /* ══════════════════════════════════════════════════ */
        /*  EXECUTION STEPS PANEL                            */
        /* ══════════════════════════════════════════════════ */
        .exec-steps-panel {
          background: rgba(15,23,42,0.4);
          border: 1px solid rgba(63,63,70,0.25);
          border-radius: 12px;
          padding: 10px;
          margin-bottom: 8px;
        }
        .exec-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        /* Progress bar */
        .exec-progress-track {
          height: 3px;
          background: rgba(63,63,70,0.3);
          border-radius: 2px;
          margin-bottom: 10px;
          position: relative;
          overflow: visible;
        }
        .exec-progress-fill {
          height: 100%;
          border-radius: 2px;
          background: linear-gradient(90deg, #3b82f6, #22c55e);
          transition: width 0.5s ease;
        }
        .exec-progress-pulse {
          position: absolute;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #3b82f6;
          box-shadow: 0 0 8px rgba(59,130,246,0.6);
          animation: progressPulse 1.5s infinite;
        }
        @keyframes progressPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.5; }
        }

        /* Steps list */
        .exec-steps-list {
          max-height: 240px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(63,63,70,0.3) transparent;
        }

        /* Individual step */
        .exec-step {
          position: relative;
          cursor: pointer;
          padding: 2px 0;
        }
        .exec-step-main {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          padding: 4px 4px;
          border-radius: 6px;
          transition: background 0.15s;
        }
        .exec-step-main:hover {
          background: rgba(63,63,70,0.1);
        }

        /* Connector line */
        .exec-step-connector {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          min-width: 14px;
          padding-top: 1px;
        }
        .connector-line {
          position: absolute;
          top: 18px;
          left: 50%;
          transform: translateX(-50%);
          width: 1px;
          height: calc(100% + 4px);
          background: rgba(63,63,70,0.3);
        }
        .exec-step:last-child .connector-line { display: none; }

        .exec-step-content { flex: 1; min-width: 0; }
        .exec-step-desc {
          font-size: 11px;
          line-height: 1.4;
          color: #a1a1aa;
        }
        .exec-step-desc.completed { color: #71717a; text-decoration: line-through; text-decoration-color: rgba(113,113,122,0.3); }
        .exec-step-desc.in-progress { color: #e2e8f0; font-weight: 500; }
        .exec-step-desc.failed { color: #fca5a5; }

        .exec-step-meta {
          font-size: 9px;
          margin-top: 1px;
        }

        /* Active step glow */
        .exec-step.step-active .exec-step-main {
          background: rgba(59,130,246,0.06);
          border: 1px solid rgba(59,130,246,0.12);
          border-radius: 8px;
        }

        /* Expanded detail */
        .exec-step-detail {
          margin: 4px 0 6px 20px;
          padding-left: 8px;
          border-left: 2px solid rgba(63,63,70,0.2);
        }
        .thought-bubble {
          background: rgba(59,130,246,0.06);
          border: 1px solid rgba(59,130,246,0.12);
          border-radius: 8px;
          padding: 6px 8px;
          margin-bottom: 4px;
        }
        .output-bubble {
          background: rgba(34,197,94,0.06);
          border: 1px solid rgba(34,197,94,0.12);
          border-radius: 8px;
          padding: 6px 8px;
        }

        /* ── Commander strip ── */
        .commander-strip {
          max-width: 1200px;
          margin: 16px auto 0;
          padding: 0 28px;
        }
        .commander-card {
          display: flex;
          align-items: center;
          gap: 14px;
          background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06));
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 14px;
          padding: 12px 18px;
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
        }
        .commander-card:hover {
          border-color: rgba(99,102,241,0.35);
          box-shadow: 0 0 30px rgba(99,102,241,0.08);
        }
        .commander-avatar {
          position: relative;
          width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(99,102,241,0.15);
          border-radius: 12px;
          border: 1px solid rgba(99,102,241,0.3);
        }
        .commander-pulse {
          position: absolute; bottom: -2px; right: -2px;
          width: 10px; height: 10px;
          background: #22c55e;
          border-radius: 50%;
          border: 2px solid #030508;
          animation: dotPulse 2s infinite;
        }
        .commander-info { flex: 1; min-width: 0; }
        .commander-badge {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #a78bfa;
          background: rgba(139,92,246,0.12);
          border: 1px solid rgba(139,92,246,0.25);
          padding: 2px 8px;
          border-radius: 6px;
        }
        .commander-status {
          display: flex; align-items: center; gap: 5px;
        }

        /* ── Task history panel ── */
        .task-history-section {
          margin-top: 8px;
          border-top: 1px solid rgba(63,63,70,0.2);
          padding-top: 6px;
        }
        .history-toggle {
          display: flex; align-items: center; gap: 5px;
          width: 100%;
          padding: 4px 0;
          background: none; border: none; cursor: pointer;
          color: #71717a;
          font-size: 10px;
          font-weight: 500;
          transition: color 0.2s;
        }
        .history-toggle:hover { color: #a1a1aa; }
        .history-list {
          max-height: 220px;
          overflow-y: auto;
          margin-top: 4px;
        }
        .history-entry {
          border-bottom: 1px solid rgba(63,63,70,0.12);
        }
        .history-entry:last-child { border-bottom: none; }
        .history-entry-header {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; gap: 8px;
          padding: 5px 2px;
          background: none; border: none; cursor: pointer;
          transition: background 0.15s;
        }
        .history-entry-header:hover { background: rgba(255,255,255,0.02); }
        .history-entry-steps {
          padding: 4px 6px 8px 18px;
        }
        .history-step {
          display: flex; align-items: center; gap: 5px;
          padding: 2px 0;
        }

        /* ── Empty state ── */
        .empty-office { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; z-index: 5; }
        .empty-icon { font-size: 48px; margin-bottom: 12px; animation: emptyFloat 3s ease-in-out infinite; }
        @keyframes emptyFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .voffice-topbar { flex-direction: column; align-items: flex-start; gap: 12px; }
          .voffice-stats { flex-wrap: wrap; }
          .office-floor { min-height: 400px; }
          .hover-detail-panel { width: 240px; max-height: 350px; }
          .commander-card { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
};

export default function VirtualOfficePage() {
  return <VirtualOfficeContent />;
}
