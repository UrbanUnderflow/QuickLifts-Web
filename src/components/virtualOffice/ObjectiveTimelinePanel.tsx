import React, { useEffect, useMemo, useState, CSSProperties } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { useRouter } from 'next/router';
import { doc, getDoc } from 'firebase/firestore';
import { AgentPresence } from '../../api/firebase/presence/service';
import { db } from '../../api/firebase/config';
import { progressTimelineService } from '../../api/firebase/progressTimeline/service';
import { kanbanService } from '../../api/firebase/kanban/service';
import { nudgeLogService } from '../../api/firebase/nudgeLog/service';
import { KanbanTask } from '../../api/firebase/kanban/types';
import {
  ProgressTimelineEntry,
  ProgressBeat,
  ConfidenceColor,
  NudgeLogEntry,
} from '../../api/firebase/progressTimeline/types';
import {
  ArrowLeft, Target, ListChecks, Copy, ChevronDown, ChevronUp,
  Zap, Clock, ExternalLink, AlertTriangle, CheckCircle2,
  Users, Flag, BarChart3, Eye,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════ */
interface ObjectiveTimelinePanelProps {
  agents: AgentPresence[];
  onClose: () => void;
}

/* ═══════════════════════════════════════════════════
   Constants & helpers (carried over from existing panel)
   ═══════════════════════════════════════════════════ */
const avatarColors: Record<string, string> = {
  nora: '#22c55e', scout: '#f59e0b', solara: '#f43f5e', sage: '#8b5cf6', antigravity: '#6366f1',
};

const OBJECTIVE_CODE_SKIP_TOKENS = new Set([
  '-', 'N/A', 'NA', 'NONE', 'UNKNOWN', 'UNASSIGNED', 'UNTRACKED', 'NIL', 'NULL', 'TBD', 'TODO', 'TEMP', 'GENERAL',
]);

const normalizeObjectiveCode = (value?: string): string => {
  const normalized = (value || '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized.length < 2 || normalized.length > 24) return '';
  if (OBJECTIVE_CODE_SKIP_TOKENS.has(normalized)) return '';
  if (normalized.includes('/') || normalized.includes('\\')) return '';
  if (normalized.includes('://')) return '';
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(normalized)) return '';
  if (normalized === '-') return '';
  if (/^\d+$/.test(normalized)) return '';
  return normalized;
};

const normalizeObjectiveMatchKey = (value?: string): string =>
  (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const FEED_BEAT_LIMIT = 200;
const FEED_NUDGE_LIMIT = 80;
const NORTH_STAR_DOC_PATH = 'company-config';
const NORTH_STAR_DOC_ID = 'north-star';
const UNLABELED_OBJECTIVE_LABEL = 'Untracked Objective';

function objectiveCodeFromLabel(label: string, idx: number, usedCodes = new Set<string>()) {
  const safe = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30)
    .toUpperCase();

  const base = `OBJ_${safe || `TRACK_${String(idx + 1).padStart(2, '0')}`}`;
  let code = base;
  let suffix = 2;
  while (usedCodes.has(code)) {
    code = `${base}_${suffix}`;
    suffix += 1;
  }
  usedCodes.add(code);
  return code;
}

interface NorthStarDoc { objectives?: string[] }

type ObjectiveProgressItem =
  | { type: 'beat'; id: string; createdAt: number; payload: ProgressTimelineEntry }
  | { type: 'nudge'; id: string; createdAt: number; payload: NudgeLogEntry };

type ObjectiveProgressGroup = {
  code: string;
  label: string;
  taskCount: number;
  doneCount: number;
  inProgressCount: number;
  todoCount: number;
  completionPercent: number;
  objectiveTasks: KanbanTask[];
  recentItems: ObjectiveProgressItem[];
  lastEventAt: number;
};

type CopyState = 'idle' | 'copied' | 'error';

const getAvatarColor = (id?: string) =>
  avatarColors[(id ?? '').toLowerCase()] || '#6366f1';

const beatMeta: Record<ProgressBeat, { label: string; color: string }> = {
  hypothesis: { label: 'Hypothesis', color: '#60a5fa' },
  'work-in-flight': { label: 'In Progress', color: '#a78bfa' },
  result: { label: 'Result', color: '#34d399' },
  block: { label: 'Blocker', color: '#f87171' },
  'signal-spike': { label: 'Signal Spike', color: '#fbbf24' },
};

/* ═══════════════════════════════════════════════════
   SVG Progress Ring
   ═══════════════════════════════════════════════════ */
const ProgressRing: React.FC<{
  percent: number;
  size?: number;
  stroke?: number;
  color: string;
}> = ({ percent, size = 72, stroke = 5, color }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
    </svg>
  );
};

/* ═══════════════════════════════════════════════════
   Milestone Dot with Tooltip
   ═══════════════════════════════════════════════════ */
const MilestoneDot: React.FC<{
  label: string;
  completed: boolean;
  active: boolean;
  index: number;
  total: number;
}> = ({ label, completed, active, index, total }) => {
  const [hovered, setHovered] = useState(false);

  const statusIcon = completed ? '✓' : active ? '●' : '○';
  const statusColor = completed ? '#34d399' : active ? '#fbbf24' : '#6b7280';
  const statusText = completed ? 'Done' : active ? 'In Progress' : 'Upcoming';

  // Determine visual state from richer status
  const isBlocked = !completed && !active && label.includes('[BLOCKED]');
  const isReviewPending = !completed && !active && label.includes('[REVIEW]');
  const hasEvidence = completed && label.includes('[EVIDENCE]');

  const dotColor = isBlocked ? '#ef4444'
    : isReviewPending ? '#3b82f6'
      : completed ? '#34d399'
        : active ? '#fbbf24'
          : '#1e293b';
  const dotBorder = isBlocked ? '2px solid #ef4444'
    : isReviewPending ? '2px solid #3b82f6'
      : completed ? '2px solid #34d399'
        : active ? '2px solid #fbbf24'
          : hovered ? '2px solid rgba(255,255,255,0.3)' : '2px solid rgba(255,255,255,0.15)';
  const dotShadow = isBlocked ? '0 0 8px rgba(239,68,68,0.5)'
    : isReviewPending ? '0 0 8px rgba(59,130,246,0.5)'
      : active ? '0 0 8px rgba(251,191,36,0.5)'
        : hovered ? '0 0 6px rgba(255,255,255,0.15)' : 'none';
  const shouldPulse = isBlocked || isReviewPending;

  const displayLabel = label.replace(/\[(BLOCKED|REVIEW|EVIDENCE)\]\s*/g, '').trim();
  const displayStatus = isBlocked ? 'Blocked'
    : isReviewPending ? 'Awaiting Review'
      : hasEvidence ? 'Achieved ✓'
        : statusText;

  // Position tooltip: center if middle dots, left-align if first few, right-align if last few
  const isNearStart = index <= 1;
  const isNearEnd = index >= total - 2;
  const tooltipAlign: CSSProperties = isNearStart
    ? { left: 0, transform: 'none' }
    : isNearEnd
      ? { right: 0, left: 'auto', transform: 'none' }
      : { left: '50%', transform: 'translateX(-50%)' };

  return (
    <div
      style={{
        flex: 1, display: 'flex', justifyContent: 'center',
        position: 'relative', zIndex: hovered ? 20 : 1,
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: active ? 14 : hovered ? 14 : 10,
        height: active ? 14 : hovered ? 14 : 10,
        borderRadius: '50%',
        background: hovered && !completed && !isBlocked && !isReviewPending ? '#334155' : dotColor,
        border: dotBorder,
        boxShadow: dotShadow,
        transition: 'all 0.15s ease',
        animation: shouldPulse ? 'pulse-badge 2s ease-in-out infinite' : 'none',
      }} />

      {/* Tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          marginBottom: 8,
          padding: '8px 12px',
          borderRadius: 10,
          background: '#1e293b',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
          maxWidth: 240,
          zIndex: 50,
          animation: 'fade-in-up 0.15s ease forwards',
          ...tooltipAlign,
        }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: '#e7e9ea',
            overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', maxWidth: 216,
          }}>
            {displayLabel}
          </div>
          <div style={{
            fontSize: 10, color: dotColor, fontWeight: 600,
            marginTop: 3, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span>{statusIcon}</span> {displayStatus}
          </div>
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            bottom: -5,
            left: isNearStart ? 12 : isNearEnd ? 'auto' : '50%',
            right: isNearEnd ? 12 : 'auto',
            transform: isNearStart || isNearEnd ? 'none' : 'translateX(-50%)',
            width: 10, height: 10,
            background: '#1e293b',
            border: '1px solid rgba(255,255,255,0.12)',
            borderTop: 'none', borderLeft: 'none',
            rotate: '45deg',
          }} />
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   Milestone Timeline (dots from subtasks)
   ═══════════════════════════════════════════════════ */
const MilestoneTimeline: React.FC<{
  tasks: KanbanTask[];
}> = ({ tasks }) => {
  const milestones = useMemo(() => {
    const allSubtasks = tasks.flatMap(t => t.subtasks || []);
    if (allSubtasks.length > 0) {
      return allSubtasks.slice(0, 8).map(s => {
        const status = s.status || (s.completed ? 'achieved' : 'not_started');
        const isBlocked = status === 'blocked';
        const isReviewPending = s.reviewRequired && !s.reviewedAt && !s.completed;
        const hasEvidence = s.completed && !!s.evidence;

        // Encode status into label prefix for MilestoneDot to read
        let labelPrefix = '';
        if (isBlocked) labelPrefix = '[BLOCKED] ';
        else if (isReviewPending) labelPrefix = '[REVIEW] ';
        else if (hasEvidence) labelPrefix = '[EVIDENCE] ';

        return {
          label: `${labelPrefix}${s.title}`,
          completed: s.completed,
          active: status === 'in_progress',
        };
      });
    }
    return tasks.slice(0, 8).map(t => ({
      label: t.name || 'Task',
      completed: t.status === 'done',
      active: t.status === 'in-progress',
    }));
  }, [tasks]);

  if (milestones.length === 0) {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0, position: 'relative',
          padding: '0 4px', height: 20,
        }}>
          <div style={{
            position: 'absolute', top: '50%', left: 8, right: 8,
            height: 2, background: 'rgba(255,255,255,0.06)', transform: 'translateY(-50%)',
            borderRadius: 1, backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.06) 6px, transparent 6px, transparent 12px)',
          }} />
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              flex: 1, display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#1e293b', border: '2px solid rgba(255,255,255,0.1)',
              }} />
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 6, fontSize: 10, color: '#4b5563',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Flag size={9} />
          <span>No milestones defined yet</span>
        </div>
      </div>
    );
  }

  const nextMilestone = milestones.find(m => !m.completed);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0, position: 'relative',
        padding: '0 4px',
      }}>
        {/* Background line */}
        <div style={{
          position: 'absolute', top: '50%', left: 8, right: 8,
          height: 2, background: 'rgba(255,255,255,0.08)', transform: 'translateY(-50%)',
        }} />
        {/* Progress line */}
        {(() => {
          const completedCount = milestones.filter(m => m.completed).length;
          const progressPercent = milestones.length > 1
            ? (completedCount / (milestones.length - 1)) * 100
            : completedCount > 0 ? 100 : 0;
          return (
            <div style={{
              position: 'absolute', top: '50%', left: 8,
              width: `calc(${Math.min(100, progressPercent)}% - 16px)`,
              height: 2, background: '#34d399', transform: 'translateY(-50%)',
              transition: 'width 0.6s ease',
            }} />
          );
        })()}
        {/* Dots with tooltips */}
        {milestones.map((m, i) => (
          <MilestoneDot
            key={i}
            label={m.label}
            completed={m.completed}
            active={m.active}
            index={i}
            total={milestones.length}
          />
        ))}
      </div>
      {nextMilestone && (
        <div style={{
          marginTop: 6, fontSize: 11, color: '#6b7280',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Flag size={10} />
          <span>Next: <span style={{ color: '#9ca3af', fontWeight: 500 }}>{nextMilestone.label}</span></span>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   Styles
   ═══════════════════════════════════════════════════ */
const S = {
  root: {
    minHeight: '100vh', background: '#030508', color: '#e7e9ea',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    boxSizing: 'border-box', overflowY: 'auto',
  } as CSSProperties,
  container: {
    width: 'min(1400px, 100%)', margin: '0 auto', padding: '20px',
  } as CSSProperties,

  // Header
  headerBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 24, gap: 16, flexWrap: 'wrap',
  } as CSSProperties,
  headerLeft: {
    display: 'flex', flexDirection: 'column', gap: 2,
  } as CSSProperties,
  title: {
    fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.03em',
    background: 'linear-gradient(135deg, #e7e9ea 0%, #9ca3af 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  } as CSSProperties,
  subtitle: {
    fontSize: 13, color: '#6b7280', margin: 0,
  } as CSSProperties,
  headerActions: {
    display: 'flex', alignItems: 'center', gap: 8,
  } as CSSProperties,
  iconBtn: (variant?: 'default' | 'copied' | 'error'): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: 12,
    background: variant === 'copied' ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: variant === 'copied' ? '#4ade80' : variant === 'error' ? '#f87171' : '#9ca3af',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.15s',
  }),

  // Summary Strip
  summaryStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12, marginBottom: 28,
  } as CSSProperties,
  summaryCard: {
    padding: '16px 20px', borderRadius: 16,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    backdropFilter: 'blur(12px)',
    display: 'flex', alignItems: 'center', gap: 14,
  } as CSSProperties,
  summaryIcon: (color: string): CSSProperties => ({
    width: 40, height: 40, borderRadius: 12,
    background: `${color}15`, border: `1px solid ${color}30`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color, flexShrink: 0,
  }),
  summaryValue: {
    fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1,
  } as CSSProperties,
  summaryLabel: {
    fontSize: 11, color: '#6b7280', fontWeight: 500, marginTop: 2,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  } as CSSProperties,

  // Objective Tabs
  tabRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    marginBottom: 24, overflowX: 'auto',
    paddingBottom: 4,
  } as CSSProperties,
  tabPill: (active: boolean): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
    borderRadius: 20,
    border: `1px solid ${active ? '#1d9bf0' : 'rgba(255,255,255,0.1)'}`,
    background: active ? 'rgba(29,155,240,0.12)' : 'rgba(255,255,255,0.02)',
    color: active ? '#1d9bf0' : '#9ca3af',
    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
    transition: 'all 0.15s',
  }),

  // Objective Grid
  objectiveGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
    gap: 16,
  } as CSSProperties,

  // Objective Card
  card: (borderColor: string, isExpanded: boolean): CSSProperties => ({
    borderRadius: 20,
    background: 'rgba(255,255,255,0.025)',
    border: `1px solid ${isExpanded ? borderColor + '40' : 'rgba(255,255,255,0.06)'}`,
    backdropFilter: 'blur(12px)',
    overflow: 'hidden',
    transition: 'all 0.2s',
    cursor: 'pointer',
  }),
  cardTop: {
    padding: '20px 24px', display: 'flex', gap: 18, alignItems: 'flex-start',
  } as CSSProperties,
  ringWrap: {
    position: 'relative', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as CSSProperties,
  ringLabel: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column',
    transform: 'rotate(0deg)', // undo parent SVG rotate
  } as CSSProperties,
  ringPercent: {
    fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1,
  } as CSSProperties,
  cardBody: {
    flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6,
  } as CSSProperties,
  statusBadge: (color: string, pulse?: boolean): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    borderRadius: 20, color,
    background: `${color}18`, border: `1px solid ${color}40`,
    animation: pulse ? 'pulse-badge 2s ease-in-out infinite' : 'none',
    alignSelf: 'flex-start',
  }),
  cardTitle: {
    fontSize: 15, fontWeight: 700, color: '#e7e9ea', lineHeight: 1.35,
    margin: 0,
  } as CSSProperties,
  cardTitleClamped: {
    fontSize: 15, fontWeight: 700, color: '#e7e9ea', lineHeight: 1.35,
    margin: 0, overflow: 'hidden', display: '-webkit-box',
    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  } as CSSProperties,
  statsRow: {
    display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2,
  } as CSSProperties,
  statPill: (color: string): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', fontSize: 11, fontWeight: 600,
    borderRadius: 8, color,
    background: `${color}12`, border: `1px solid ${color}25`,
  }),
  agentAvatarRow: {
    display: 'flex', alignItems: 'center', gap: -4, marginTop: 4,
  } as CSSProperties,
  agentAvatar: (color: string, idx: number): CSSProperties => ({
    width: 24, height: 24, borderRadius: '50%',
    background: `linear-gradient(135deg, ${color}40, ${color}20)`,
    border: `2px solid #0a0e14`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 700, color,
    marginLeft: idx > 0 ? -6 : 0,
    zIndex: 10 - idx,
  }),

  // Expanded Detail
  expandedSection: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    padding: '16px 24px 20px',
    background: 'rgba(0,0,0,0.15)',
  } as CSSProperties,
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: 10,
    display: 'flex', alignItems: 'center', gap: 6,
  } as CSSProperties,
  taskItem: (statusColor: string): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 10,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    marginBottom: 6,
  }),
  taskStatusDot: (color: string): CSSProperties => ({
    width: 8, height: 8, borderRadius: '50%',
    background: color, flexShrink: 0,
  }),
  actionBar: {
    display: 'flex', gap: 8, marginTop: 14,
  } as CSSProperties,
  actionBtn: (color: string): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '7px 14px', fontSize: 12, fontWeight: 600,
    borderRadius: 10, cursor: 'pointer',
    background: `${color}12`, border: `1px solid ${color}30`,
    color, transition: 'all 0.15s',
  }),

  // Signal items
  signalItem: {
    fontSize: 12, color: '#d1d5db', lineHeight: 1.5,
    padding: '4px 0',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  } as CSSProperties,

  // Empty state
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '80px 20px', gap: 12,
  } as CSSProperties,

  // Full-width detail mode
  detailPanel: {
    borderRadius: 20,
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.06)',
    backdropFilter: 'blur(12px)',
    overflow: 'hidden',
    marginBottom: 16,
  } as CSSProperties,
};

/* Keyframes injected once */
const styleTag = typeof document !== 'undefined' ? (() => {
  const existing = document.getElementById('obj-timeline-keyframes');
  if (existing) return existing;
  const tag = document.createElement('style');
  tag.id = 'obj-timeline-keyframes';
  tag.textContent = `
    @keyframes pulse-badge {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(tag);
  return tag;
})() : null;

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */
const ObjectiveTimelinePanel: React.FC<ObjectiveTimelinePanelProps> = ({
  agents,
}) => {
  const router = useRouter();

  /* ── State ── */
  const [entries, setEntries] = useState<ProgressTimelineEntry[]>([]);
  const [nudges, setNudges] = useState<NudgeLogEntry[]>([]);
  const [objectiveTasks, setObjectiveTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [objectiveLabelByCode, setObjectiveLabelByCode] = useState<Record<string, string>>({});
  const [northStarObjectiveLabels, setNorthStarObjectiveLabels] = useState<string[]>([]);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('__all__');
  const [signalExpanded, setSignalExpanded] = useState<Record<string, boolean>>({});
  const [copyState, setCopyState] = useState<CopyState>('idle');

  /* ── Data fetch (same as existing panel) ── */
  useEffect(() => {
    const u1 = progressTimelineService.listen((items) => { setEntries(items); setLoading(false); }, { limit: FEED_BEAT_LIMIT });
    const u3 = nudgeLogService.listen((items) => setNudges(items), { limit: FEED_NUDGE_LIMIT });
    let active = true;

    const hydrate = async () => {
      try {
        const tasks = await kanbanService.fetchAllTasks();
        const labels: Record<string, string> = {};
        let northStarObjectives: string[] = [];

        tasks.forEach((task) => {
          const code = normalizeObjectiveCode(task.objectiveCode);
          const taskLabel = String(task.northStarObjective || '').trim();
          if (!code || !taskLabel) return;
          if (!labels[code]) labels[code] = taskLabel;
        });

        try {
          const snap = await getDoc(doc(db, NORTH_STAR_DOC_PATH, NORTH_STAR_DOC_ID));
          if (snap.exists()) {
            const payload = snap.data() as NorthStarDoc;
            northStarObjectives = (payload.objectives || [])
              .map((o) => String(o || '').trim())
              .filter(Boolean);
          }
        } catch (e) {
          console.error('Failed to load north star objectives', e);
        }

        if (active) {
          setObjectiveTasks(tasks);
          setObjectiveLabelByCode(labels);
          setNorthStarObjectiveLabels(northStarObjectives);
        }
      } catch (e) {
        console.error('Failed to hydrate objective labels', e);
      }
    };
    void hydrate();

    return () => { active = false; u1(); u3(); };
  }, []);

  /* ── Resolve labels via North Star ── */
  // Build a map: normalized-label-key → original label
  const northStarLabelMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    (northStarObjectiveLabels || []).forEach(label => {
      const key = normalizeObjectiveCode(label);
      if (key) map[key] = String(label || '').trim();
    });
    return map;
  }, [northStarObjectiveLabels]);

  // Resolve a task/beat to its North Star objective label key
  // Tries: task.northStarObjective label match, task.objectiveCode label match,
  //        then fuzzy substring match
  const resolveToNorthStar = (
    objectiveCode: string,
    northStarObjective?: string
  ): { key: string; label: string } | null => {
    const nsKeys = Object.keys(northStarLabelMap);
    if (nsKeys.length === 0) return null;

    // Try direct label match from northStarObjective field
    if (northStarObjective) {
      const nsKey = normalizeObjectiveCode(northStarObjective);
      if (nsKey && northStarLabelMap[nsKey]) {
        return { key: nsKey, label: northStarLabelMap[nsKey] };
      }
      // Fuzzy: check if northStarObjective contains/is-contained-by a tracked label
      const nsNorm = normalizeObjectiveCode(northStarObjective);
      if (nsNorm && nsNorm.length >= 6) {
        for (const [k, v] of Object.entries(northStarLabelMap)) {
          if (nsNorm.includes(k) || k.includes(nsNorm)) return { key: k, label: v };
        }
      }
    }

    // Try objectiveCode as label key
    if (objectiveCode) {
      const codeKey = normalizeObjectiveCode(objectiveCode);
      if (codeKey && northStarLabelMap[codeKey]) {
        return { key: codeKey, label: northStarLabelMap[codeKey] };
      }
    }

    // Try objectiveLabelByCode (from task data)
    if (objectiveCode) {
      const fromTasks = objectiveLabelByCode[normalizeObjectiveCode(objectiveCode)];
      if (fromTasks) {
        const ftKey = normalizeObjectiveCode(fromTasks);
        if (ftKey && northStarLabelMap[ftKey]) {
          return { key: ftKey, label: northStarLabelMap[ftKey] };
        }
        // Fuzzy
        if (ftKey && ftKey.length >= 6) {
          for (const [k, v] of Object.entries(northStarLabelMap)) {
            if (ftKey.includes(k) || k.includes(ftKey)) return { key: k, label: v };
          }
        }
      }
    }

    return null;
  };

  /* ── Objective groups ── */
  const objectiveGroups = useMemo<ObjectiveProgressGroup[]>(() => {
    const groups = new Map<string, ObjectiveProgressGroup>();

    const ensureGroup = (key: string, label: string) => {
      if (groups.has(key)) return groups.get(key)!;
      const g: ObjectiveProgressGroup = {
        code: key, label, taskCount: 0, doneCount: 0, inProgressCount: 0, todoCount: 0,
        completionPercent: 0, objectiveTasks: [], recentItems: [], lastEventAt: 0,
      };
      groups.set(key, g);
      return g;
    };

    // Pre-create groups for all North Star objectives
    Object.entries(northStarLabelMap).forEach(([key, label]) => {
      ensureGroup(key, label);
    });

    // Assign tasks to groups
    objectiveTasks.forEach(task => {
      const match = resolveToNorthStar(task.objectiveCode, task.northStarObjective);
      if (!match) return;
      const g = ensureGroup(match.key, match.label);
      g.taskCount++;
      if (task.status === 'done') g.doneCount++;
      else if (task.status === 'in-progress') g.inProgressCount++;
      else g.todoCount++;
      g.objectiveTasks.push(task);
    });

    // Assign beats to groups
    entries.forEach(entry => {
      const match = resolveToNorthStar(entry.objectiveCode, entry.objectiveCodeLabel);
      if (!match) return;
      const g = ensureGroup(match.key, match.label);
      const ts = entry.createdAt?.getTime?.() || 0;
      g.recentItems.push({ type: 'beat', id: `b-${entry.id}`, createdAt: ts, payload: entry });
      if (ts > g.lastEventAt) g.lastEventAt = ts;
    });

    // Assign nudges to groups
    nudges.forEach(entry => {
      const match = resolveToNorthStar(entry.objectiveCode);
      if (!match) return;
      const g = ensureGroup(match.key, match.label);
      const ts = entry.createdAt?.getTime?.() || 0;
      g.recentItems.push({ type: 'nudge', id: `n-${entry.id}`, createdAt: ts, payload: entry });
      if (ts > g.lastEventAt) g.lastEventAt = ts;
    });

    // Back-fill lastEventAt from tasks
    objectiveTasks.forEach(task => {
      const match = resolveToNorthStar(task.objectiveCode, task.northStarObjective);
      if (!match) return;
      const g = groups.get(match.key);
      if (g && !g.lastEventAt) {
        g.lastEventAt = task.updatedAt?.getTime?.() || task.createdAt?.getTime?.() || 0;
      }
    });

    // Compute completion
    groups.forEach(g => {
      const total = g.taskCount || 1;
      g.completionPercent = Math.round((g.doneCount / total) * 100);
      g.recentItems.sort((a, b) => b.createdAt - a.createdAt);
    });

    return [...groups.values()].sort((a, b) => b.lastEventAt - a.lastEventAt);
  }, [entries, nudges, objectiveTasks, northStarLabelMap, objectiveLabelByCode]);

  /* ── Derived stats ── */
  const totalObjectives = objectiveGroups.length;
  const overallCompletion = totalObjectives > 0
    ? Math.round(objectiveGroups.reduce((s, g) => s + g.completionPercent, 0) / totalObjectives)
    : 0;
  const needsAttentionCount = objectiveGroups.filter(
    g => g.taskCount === 0 || (g.completionPercent < 40 && g.taskCount > 0)
  ).length;
  const uniqueAgentIds = useMemo(() => {
    const ids = new Set<string>();
    objectiveTasks.forEach(t => { if (t.assignee) ids.add(t.assignee.toLowerCase()); });
    return ids.size;
  }, [objectiveTasks]);
  const totalTasks = objectiveGroups.reduce((s, g) => s + g.taskCount, 0);
  const totalDone = objectiveGroups.reduce((s, g) => s + g.doneCount, 0);
  const needsReviewCount = useMemo(() => {
    return objectiveTasks.reduce((count, t) => {
      return count + (t.subtasks || []).filter(
        s => s.reviewRequired && !s.reviewedAt && !s.completed
      ).length;
    }, 0);
  }, [objectiveTasks]);

  /* ── Visible groups ── */
  const visibleGroups = useMemo(() => {
    if (activeTab === '__all__') return objectiveGroups;
    return objectiveGroups.filter(g => g.code === activeTab);
  }, [activeTab, objectiveGroups]);

  const truncateLabel = (s: string, max = 35) =>
    s.length > max ? s.slice(0, max).trimEnd() + '…' : s;

  const tabMeta = useMemo(() => [
    { code: '__all__', label: 'All Objectives', fullLabel: 'All Objectives' },
    ...objectiveGroups.map(g => ({ code: g.code, label: truncateLabel(g.label), fullLabel: g.label })),
  ], [objectiveGroups]);

  /* ── Status helpers ── */
  const getStatusInfo = (g: ObjectiveProgressGroup) => {
    if (g.taskCount === 0) return { label: 'No Tasks', color: '#f59e0b', pulse: true };
    if (g.completionPercent >= 100) return { label: 'Complete', color: '#34d399', pulse: false };
    const hasBlocker = g.recentItems.some(
      i => i.type === 'beat' && (i.payload as ProgressTimelineEntry).beat === 'block'
    );
    if (hasBlocker) return { label: 'Blocked', color: '#ef4444', pulse: true };
    if (g.inProgressCount > 0) return { label: 'In Progress', color: '#60a5fa', pulse: false };
    if (g.completionPercent > 0) return { label: 'On Track', color: '#34d399', pulse: false };
    return { label: 'Not Started', color: '#fbbf24', pulse: true };
  };

  const getProgressColor = (percent: number) =>
    percent >= 70 ? '#34d399' : percent >= 40 ? '#fbbf24' : '#ef4444';

  const taskStatusColor = (status: string) => {
    if (status === 'done') return '#34d399';
    if (status === 'in-progress') return '#f59e0b';
    return '#6b7280';
  };

  /* ── Copy ── */
  const handleCopy = async () => {
    const lines: string[] = [
      'Objective Timeline Export',
      `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`,
      `Objectives: ${totalObjectives}  |  Overall: ${overallCompletion}%  |  Tasks: ${totalDone}/${totalTasks}`,
      '',
    ];
    objectiveGroups.forEach((g, i) => {
      lines.push(`[${i + 1}] ${g.label} (${g.code}) — ${g.completionPercent}% complete`);
      lines.push(`    Tasks: ${g.taskCount} (${g.doneCount} done, ${g.inProgressCount} active, ${g.todoCount} queued)`);
      if (g.recentItems.length > 0) {
        lines.push('    Recent:');
        g.recentItems.slice(0, 3).forEach(item => {
          if (item.type === 'beat') {
            const e = item.payload as ProgressTimelineEntry;
            lines.push(`      • ${e.agentName || e.agentId}: ${e.headline}`);
          } else {
            const e = item.payload as NudgeLogEntry;
            lines.push(`      • [Nudge] ${e.agentName || e.agentId}: ${e.message}`);
          }
        });
      }
      lines.push('');
    });
    const text = lines.join('\n').trim();
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
    setTimeout(() => setCopyState('idle'), 1600);
  };

  /* ── Agent list per objective ── */
  const getObjectiveAgents = (g: ObjectiveProgressGroup) => {
    const seen = new Set<string>();
    const result: { id: string; initial: string }[] = [];
    g.objectiveTasks.forEach(t => {
      const a = (t.assignee || '').toLowerCase();
      if (!a || seen.has(a)) return;
      seen.add(a);
      result.push({ id: a, initial: a.charAt(0).toUpperCase() });
    });
    return result.slice(0, 5);
  };

  /* ═══════════════════════════════════════════════════
     Render: Objective Card
     ═══════════════════════════════════════════════════ */
  const renderObjectiveCard = (group: ObjectiveProgressGroup) => {
    const status = getStatusInfo(group);
    const progressColor = getProgressColor(group.completionPercent);
    const isExpanded = expandedCard === group.code;
    const objAgents = getObjectiveAgents(group);
    const lastEvent = group.lastEventAt
      ? formatDistanceToNow(new Date(group.lastEventAt), { addSuffix: true })
      : 'No activity';
    const showSignals = signalExpanded[group.code] || false;

    return (
      <div
        key={group.code}
        style={{
          ...S.card(progressColor, isExpanded),
          animation: 'fade-in-up 0.3s ease forwards',
        }}
        onClick={() => setExpandedCard(isExpanded ? null : group.code)}
      >
        {/* Top section */}
        <div style={S.cardTop}>
          {/* Progress Ring */}
          <div style={S.ringWrap as CSSProperties}>
            <ProgressRing percent={group.completionPercent} color={progressColor} />
            <div style={S.ringLabel as CSSProperties}>
              <span style={{ ...S.ringPercent, color: progressColor }}>
                {group.completionPercent}%
              </span>
            </div>
          </div>

          {/* Body */}
          <div style={S.cardBody as CSSProperties}>
            <div style={S.statusBadge(status.color, status.pulse)}>
              {status.label}
            </div>
            <h3 style={S.cardTitleClamped} title={group.label}>{group.label}</h3>

            {/* Stats pills */}
            <div style={S.statsRow}>
              <span style={S.statPill('#34d399')}>{group.doneCount} done</span>
              <span style={S.statPill('#f59e0b')}>{group.inProgressCount} active</span>
              <span style={S.statPill('#6b7280')}>{group.todoCount} queued</span>
            </div>

            {/* Agent avatars */}
            {objAgents.length > 0 && (
              <div style={S.agentAvatarRow}>
                {objAgents.map((a, i) => (
                  <div key={a.id} style={S.agentAvatar(getAvatarColor(a.id), i)} title={a.id}>
                    {a.initial}
                  </div>
                ))}
              </div>
            )}

            {/* Milestone timeline */}
            <MilestoneTimeline tasks={group.objectiveTasks} />

            {/* Last activity */}
            <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} /> {lastEvent}
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            </div>
          </div>
        </div>

        {/* Expanded detail section */}
        {isExpanded && (
          <div style={S.expandedSection} onClick={(e) => e.stopPropagation()}>
            {/* Linked Tasks */}
            <div style={S.sectionLabel as CSSProperties}>
              <ListChecks size={12} /> Linked Tasks ({group.taskCount})
            </div>
            {group.objectiveTasks.length === 0 ? (
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
                No tasks linked to this objective yet.
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                {group.objectiveTasks.map(task => {
                  const sc = taskStatusColor(task.status);
                  return (
                    <div key={task.id} style={S.taskItem(sc)}>
                      <div style={S.taskStatusDot(sc)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e7e9ea' }}>
                          {task.name || 'Unnamed task'}
                        </div>
                        {task.assignee && (
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                            {task.assignee}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: sc,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {task.status === 'done' ? 'Done' : task.status === 'in-progress' ? 'Active' : 'Queued'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Signals */}
            <div
              style={{ ...S.sectionLabel as CSSProperties, cursor: 'pointer' }}
              onClick={() => setSignalExpanded(s => ({ ...s, [group.code]: !s[group.code] }))}
            >
              <Zap size={12} /> Recent Signals ({group.recentItems.length})
              <span style={{ marginLeft: 'auto' }}>
                {showSignals ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            </div>
            {showSignals && (
              group.recentItems.length === 0 ? (
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
                  No signals yet.
                </div>
              ) : (
                <div style={{ marginBottom: 14 }}>
                  {group.recentItems.slice(0, 10).map(item => {
                    if (item.type === 'beat') {
                      const e = item.payload as ProgressTimelineEntry;
                      const bm = beatMeta[e.beat];
                      return (
                        <div key={item.id} style={S.signalItem}>
                          <span style={{ color: '#6b7280' }}>
                            {formatDistanceToNow(e.createdAt || new Date(), { addSuffix: true })}
                          </span>
                          {' '}
                          <span style={{ color: getAvatarColor(e.agentId), fontWeight: 600 }}>
                            {e.agentName || e.agentId}
                          </span>
                          {' '}
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: bm.color,
                            padding: '1px 6px', borderRadius: 6,
                            background: `${bm.color}15`,
                          }}>
                            {bm.label}
                          </span>
                          {' — '}{e.headline}
                        </div>
                      );
                    }
                    const e = item.payload as NudgeLogEntry;
                    return (
                      <div key={item.id} style={S.signalItem}>
                        <span style={{ color: '#6b7280' }}>
                          {formatDistanceToNow(e.createdAt || new Date(), { addSuffix: true })}
                        </span>
                        {' '}
                        <span style={{ color: '#a78bfa', fontWeight: 600 }}>{e.agentName || e.agentId}</span>
                        {' '}
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: '#a78bfa',
                          padding: '1px 6px', borderRadius: 6,
                          background: 'rgba(139,92,246,0.12)',
                        }}>
                          Nudge
                        </span>
                        {' — '}{e.message}
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Action Buttons */}
            <div style={S.actionBar}>
              <button
                style={S.actionBtn('#1d9bf0')}
                onClick={() => {
                  const firstTask = group.objectiveTasks[0];
                  if (firstTask) {
                    router.push(`/admin/projectManagement?taskId=${encodeURIComponent(firstTask.objectiveCode || firstTask.id)}`);
                  }
                }}
              >
                <ExternalLink size={12} /> Inspect
              </button>
              <button style={S.actionBtn('#fbbf24')}>
                <AlertTriangle size={12} /> Escalate
              </button>
              <button style={S.actionBtn('#6b7280')}>
                <Clock size={12} /> Pause
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════
     Render: Full detail view for single objective
     ═══════════════════════════════════════════════════ */
  const renderDetailView = (group: ObjectiveProgressGroup) => {
    const status = getStatusInfo(group);
    const progressColor = getProgressColor(group.completionPercent);
    const objAgents = getObjectiveAgents(group);

    return (
      <div key={`detail-${group.code}`} style={S.detailPanel}>
        <div style={{ padding: '24px 28px', display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={S.ringWrap as CSSProperties}>
            <ProgressRing percent={group.completionPercent} size={96} stroke={6} color={progressColor} />
            <div style={S.ringLabel as CSSProperties}>
              <span style={{ ...S.ringPercent, fontSize: 22, color: progressColor }}>
                {group.completionPercent}%
              </span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={S.statusBadge(status.color, status.pulse)}>{status.label}</div>
            <h2 style={{ ...S.cardTitle, fontSize: 20, marginTop: 6 }}>{group.label}</h2>

            <div style={{ ...S.statsRow, marginTop: 8 }}>
              <span style={S.statPill('#34d399')}>{group.doneCount} done</span>
              <span style={S.statPill('#f59e0b')}>{group.inProgressCount} active</span>
              <span style={S.statPill('#6b7280')}>{group.todoCount} queued</span>
            </div>
            {objAgents.length > 0 && (
              <div style={{ ...S.agentAvatarRow, marginTop: 10 }}>
                {objAgents.map((a, i) => (
                  <div key={a.id} style={S.agentAvatar(getAvatarColor(a.id), i)} title={a.id}>
                    {a.initial}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <MilestoneTimeline tasks={group.objectiveTasks} />

        {/* Tasks */}
        <div style={{ padding: '20px 28px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={S.sectionLabel as CSSProperties}>
            <ListChecks size={12} /> Linked Tasks ({group.taskCount})
          </div>
          {group.objectiveTasks.map(task => {
            const sc = taskStatusColor(task.status);
            return (
              <div key={task.id} style={S.taskItem(sc)}>
                <div style={S.taskStatusDot(sc)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e7e9ea' }}>
                    {task.name || 'Unnamed task'}
                  </div>
                  {task.description && (
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{task.description}</div>
                  )}
                  {task.assignee && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      Assignee: <strong>{task.assignee}</strong>
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: sc,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {task.status === 'done' ? 'Done' : task.status === 'in-progress' ? 'Active' : 'Queued'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Signals */}
        <div style={{ padding: '20px 28px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={S.sectionLabel as CSSProperties}>
            <Zap size={12} /> Recent Signals ({group.recentItems.length})
          </div>
          {group.recentItems.slice(0, 15).map(item => {
            if (item.type === 'beat') {
              const e = item.payload as ProgressTimelineEntry;
              const bm = beatMeta[e.beat];
              return (
                <div key={item.id} style={S.signalItem}>
                  <span style={{ color: '#6b7280' }}>
                    {formatDistanceToNow(e.createdAt || new Date(), { addSuffix: true })}
                  </span>
                  {' '}
                  <span style={{ color: getAvatarColor(e.agentId), fontWeight: 600 }}>
                    {e.agentName || e.agentId}
                  </span>
                  {' '}
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: bm.color,
                    padding: '1px 6px', borderRadius: 6, background: `${bm.color}15`,
                  }}>
                    {bm.label}
                  </span>
                  {' — '}{e.headline}
                </div>
              );
            }
            const e = item.payload as NudgeLogEntry;
            return (
              <div key={item.id} style={S.signalItem}>
                <span style={{ color: '#6b7280' }}>
                  {formatDistanceToNow(e.createdAt || new Date(), { addSuffix: true })}
                </span>
                {' '}
                <span style={{ color: '#a78bfa', fontWeight: 600 }}>{e.agentName || e.agentId}</span>
                {' '}
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#a78bfa',
                  padding: '1px 6px', borderRadius: 6, background: 'rgba(139,92,246,0.12)',
                }}>
                  Nudge
                </span>
                {' — '}{e.message}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={S.actionBar}>
            <button
              style={S.actionBtn('#1d9bf0')}
              onClick={() => {
                const firstTask = group.objectiveTasks[0];
                if (firstTask) {
                  router.push(`/admin/projectManagement?taskId=${encodeURIComponent(firstTask.objectiveCode || firstTask.id)}`);
                }
              }}
            >
              <ExternalLink size={12} /> Inspect in Kanban
            </button>
            <button style={S.actionBtn('#fbbf24')}>
              <AlertTriangle size={12} /> Escalate
            </button>
            <button style={S.actionBtn('#6b7280')}>
              <Clock size={12} /> Pause
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════
     Main Render
     ═══════════════════════════════════════════════════ */
  return (
    <div style={S.root}>
      <div style={S.container}>

        {/* ── Header ── */}
        <div style={S.headerBar}>
          <div style={S.headerLeft as CSSProperties}>
            <h1 style={S.title}>Objective Timeline</h1>
            <p style={S.subtitle}>
              Strategic execution radar — objective-first progress tracking
            </p>
          </div>
          <div style={S.headerActions}>
            <button
              style={S.iconBtn(copyState === 'idle' ? 'default' : copyState)}
              onClick={() => { void handleCopy(); }}
              title={copyState === 'copied' ? 'Copied!' : 'Export objectives'}
            >
              <Copy size={14} />
              {copyState === 'copied' ? 'Copied' : 'Export'}
            </button>
            <button
              style={S.iconBtn('default')}
              onClick={() => router.push('/admin/virtualOffice')}
            >
              <ArrowLeft size={14} /> Back
            </button>
          </div>
        </div>

        {/* ── Summary Strip ── */}
        <div style={S.summaryStrip}>
          <div style={S.summaryCard}>
            <div style={S.summaryIcon('#1d9bf0')}>
              <Target size={18} />
            </div>
            <div>
              <div style={S.summaryValue}>{totalObjectives}</div>
              <div style={S.summaryLabel as CSSProperties}>Objectives</div>
            </div>
          </div>
          <div style={S.summaryCard}>
            <div style={S.summaryIcon(overallCompletion >= 50 ? '#34d399' : '#fbbf24')}>
              <BarChart3 size={18} />
            </div>
            <div>
              <div style={{ ...S.summaryValue, color: overallCompletion >= 50 ? '#34d399' : '#fbbf24' }}>
                {overallCompletion}%
              </div>
              <div style={S.summaryLabel as CSSProperties}>Overall Progress</div>
            </div>
          </div>
          <div style={S.summaryCard}>
            <div style={S.summaryIcon('#a78bfa')}>
              <Users size={18} />
            </div>
            <div>
              <div style={S.summaryValue}>{uniqueAgentIds}</div>
              <div style={S.summaryLabel as CSSProperties}>Active Agents</div>
            </div>
          </div>
          <div style={S.summaryCard}>
            <div style={S.summaryIcon(needsAttentionCount > 0 ? '#ef4444' : '#34d399')}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <div style={{
                ...S.summaryValue,
                color: needsAttentionCount > 0 ? '#ef4444' : '#34d399',
              }}>
                {needsAttentionCount}
              </div>
              <div style={S.summaryLabel as CSSProperties}>Need Attention</div>
            </div>
          </div>
          {needsReviewCount > 0 && (
            <div style={S.summaryCard}>
              <div style={S.summaryIcon('#3b82f6')}>
                <Eye size={18} />
              </div>
              <div>
                <div style={{
                  ...S.summaryValue,
                  color: '#3b82f6',
                }}>
                  {needsReviewCount}
                </div>
                <div style={S.summaryLabel as CSSProperties}>Needs Review</div>
              </div>
            </div>
          )}
          <div style={S.summaryCard}>
            <div style={S.summaryIcon('#34d399')}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div style={S.summaryValue}>{totalDone}<span style={{ color: '#6b7280', fontWeight: 500, fontSize: 14 }}>/{totalTasks}</span></div>
              <div style={S.summaryLabel as CSSProperties}>Tasks Done</div>
            </div>
          </div>
        </div>

        {/* ── Objective Tabs ── */}
        {tabMeta.length > 1 && (
          <div style={S.tabRow}>
            {tabMeta.map(tab => (
              <button
                key={tab.code}
                style={S.tabPill(activeTab === tab.code)}
                onClick={() => setActiveTab(tab.code)}
                title={tab.fullLabel}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div style={S.empty as CSSProperties}>
            <div style={{
              width: 36, height: 36, border: '3px solid rgba(255,255,255,0.08)',
              borderTop: '3px solid #1d9bf0', borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>Loading objectives…</p>
          </div>
        ) : objectiveGroups.length === 0 ? (
          <div style={S.empty as CSSProperties}>
            <Target size={40} style={{ opacity: 0.2/*, color: '#6b7280'*/ }} />
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#6b7280' }}>
              No objectives tracked yet
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#4b5563', maxWidth: 400, textAlign: 'center' }}>
              Objectives appear here when agents post beats with objective codes or when tasks
              are created with objective associations in the Kanban board.
            </p>
          </div>
        ) : activeTab !== '__all__' ? (
          // Single objective detail view
          visibleGroups.map(renderDetailView)
        ) : (
          // Grid of cards
          <div style={S.objectiveGrid}>
            {visibleGroups.map(renderObjectiveCard)}
          </div>
        )}
      </div>

      {/* Inject spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ObjectiveTimelinePanel;
