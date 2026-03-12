import React, { useState, useEffect, useCallback, CSSProperties } from 'react';
import Head from 'next/head';
import {
    Rocket, Square, RefreshCw, Star, Users,
    CheckCircle2, XCircle, Clock, Zap,
    AlertTriangle, Loader2, Activity, Brain,
} from 'lucide-react';
import { db } from '../../api/firebase/config';
import { presenceService } from '../../api/firebase/presence/service';
import {
    doc, getDoc, collection, query, where, onSnapshot,
    limit, updateDoc, serverTimestamp, Timestamp
} from 'firebase/firestore';

/* ─── Types ─────────────────────────────────────────── */

interface MissionStatus {
    status: 'idle' | 'active' | 'paused';
    missionId?: string;
    northStarTitle?: string;
    missionSummary?: string;
    kickoffChatId?: string;
    agentObjectives?: Record<string, string>;
    taskCount?: number;
    startedAt?: Timestamp;
    updatedAt?: Timestamp;
}

interface NorthStar {
    title: string;
    description?: string;
    objectives?: string[];
}

interface ProposedObjective {
    id: string;
    title: string;
    reason: string;
    proposedBy: string;
    proposedByName: string;
    proposedByEmoji?: string;
    status: 'proposed' | 'approved' | 'rejected' | 'auto-approved';
    autoApproveAt?: { seconds: number };
    proposedAt?: Timestamp;
}

interface AgentTask {
    id: string;
    name: string;
    status: string;
    assignee: string;
    priority?: string;
    northStarObjective?: string;
    northStarScore?: number;
    northStarVerdict?: string;
}

/* ─── Constants ─────────────────────────────────────── */

const AGENTS = [
    { id: 'nora', name: 'Nora', emoji: '⚡', color: '#6366f1' },
    { id: 'scout', name: 'Scout', emoji: '🔭', color: '#22d3ee' },
    { id: 'solara', name: 'Solara', emoji: '☀️', color: '#f59e0b' },
    { id: 'sage', name: 'Sage', emoji: '🌿', color: '#22c55e' },
];
type ModelUpgradeOption = {
    value: string;
    label: string;
};

const DEFAULT_MODEL_UPGRADE_TARGET = 'openai/gpt-5.3-codex';
const MODEL_UPGRADE_OPTIONS: ModelUpgradeOption[] = [
    { value: 'openai/gpt-5.3-codex', label: 'OpenAI: gpt-5.3-codex' },
    { value: 'openai/gpt-5.2-codex', label: 'OpenAI: gpt-5.2-codex' },
    { value: 'openai/gpt-5.1-codex-max', label: 'OpenAI: gpt-5.1-codex-max' },
    { value: 'openai/gpt-5.1-codex-mini', label: 'OpenAI: gpt-5.1-codex-mini' },
    { value: 'openai/gpt-5.1-codex', label: 'OpenAI: gpt-5.1-codex' },
    { value: 'openai/gpt-5-codex', label: 'OpenAI: gpt-5-codex' },
    { value: 'openai/o3-mini', label: 'OpenAI: o3-mini' },
    { value: 'openai/o4-mini', label: 'OpenAI: o4-mini' },
    { value: 'openai/o3-deep-research', label: 'OpenAI: o3-deep-research' },
    { value: 'openai/o4-mini-deep-research', label: 'OpenAI: o4-mini-deep-research' },
    { value: 'openai/o3', label: 'OpenAI: o3' },
    { value: 'openai/o3-pro', label: 'OpenAI: o3-pro' },
    { value: 'openai/o1-pro', label: 'OpenAI: o1-pro' },
    { value: 'openai/o1-mini', label: 'OpenAI: o1-mini' },
    { value: 'openai/o1', label: 'OpenAI: o1' },
    { value: 'openai/gpt-5.2-pro', label: 'OpenAI: gpt-5.2-pro' },
    { value: 'openai/gpt-5-pro', label: 'OpenAI: gpt-5-pro' },
    { value: 'openai/gpt-5.2', label: 'OpenAI: gpt-5.2' },
    { value: 'openai/gpt-5.2-chat-latest', label: 'OpenAI: gpt-5.2-chat-latest' },
    { value: 'openai/gpt-5.1', label: 'OpenAI: gpt-5.1' },
    { value: 'openai/gpt-5.1-chat-latest', label: 'OpenAI: gpt-5.1-chat-latest' },
    { value: 'openai/gpt-5-mini', label: 'OpenAI: gpt-5-mini' },
    { value: 'openai/gpt-5-nano', label: 'OpenAI: gpt-5-nano' },
    { value: 'openai/gpt-5-chat-latest', label: 'OpenAI: gpt-5-chat-latest' },
    { value: 'openai/codex-mini-latest', label: 'OpenAI: codex-mini-latest' },
    { value: 'openai/gpt-4.1-nano', label: 'OpenAI: gpt-4.1-nano' },
    { value: 'openai/gpt-4.1-mini', label: 'OpenAI: gpt-4.1-mini' },
    { value: 'openai/gpt-4.1', label: 'OpenAI: gpt-4.1' },
    { value: 'openai/gpt-4o-2024-05-13', label: 'OpenAI: gpt-4o-2024-05-13' },
    { value: 'openai/gpt-4o-mini', label: 'OpenAI: gpt-4o-mini' },
    { value: 'openai/gpt-4o', label: 'OpenAI: gpt-4o' },
    { value: 'anthropic/claude-opus-4', label: 'Anthropic: claude-opus-4' },
    { value: 'anthropic/claude-opus-4.1', label: 'Anthropic: claude-opus-4.1' },
    { value: 'anthropic/claude-sonnet-4', label: 'Anthropic: claude-sonnet-4' },
    { value: 'anthropic/claude-sonnet-3.7', label: 'Anthropic: claude-sonnet-3.7' },
    { value: 'anthropic/claude-sonnet-3.5', label: 'Anthropic: claude-sonnet-3.5' },
    { value: 'anthropic/claude-haiku-3.5', label: 'Anthropic: claude-haiku-3.5' },
].sort((a, b) => a.label.localeCompare(b.label));

/* ─── Utils ─────────────────────────────────────────── */

function formatTimeAgo(ts?: Timestamp | null): string {
    if (!ts) return '';
    const ms = Date.now() - ts.toDate().getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function formatAutoApproveCountdown(autoApproveAt?: { seconds: number }): string {
    if (!autoApproveAt) return '';
    const ms = autoApproveAt.seconds * 1000 - Date.now();
    if (ms <= 0) return 'Auto-approving...';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `Auto-approves in ${h}h ${m}m`;
}

/* ─── Styles ─────────────────────────────────────────── */

const S: Record<string, CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: '#080811',
        color: '#e4e4e7',
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: '0',
    },
    header: {
        padding: '28px 32px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10,10,20,0.8)',
        backdropFilter: 'blur(20px)',
        position: 'sticky' as const,
        top: 0,
        zIndex: 10,
    },
    headerTop: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20,
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 16 },
    headerIcon: {
        width: 52, height: 52, borderRadius: 16,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 32px rgba(99,102,241,0.4)',
    },
    pageTitle: { fontSize: 24, fontWeight: 800, color: '#f4f4f5', margin: 0 },
    pageSubtitle: { fontSize: 13, color: '#71717a', margin: '3px 0 0' },
    body: { padding: '28px 32px', display: 'flex', flexDirection: 'column' as const, gap: 24 },
    // Mission status card
    missionCard: {
        borderRadius: 20,
        padding: 28,
        border: '1px solid',
        background: 'rgba(255,255,255,0.02)',
        position: 'relative' as const,
        overflow: 'hidden',
    },
    missionCardActive: {
        borderColor: 'rgba(34,197,94,0.2)',
        background: 'rgba(34,197,94,0.03)',
    },
    missionCardIdle: {
        borderColor: 'rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
    },
    missionCardPaused: {
        borderColor: 'rgba(251,191,36,0.2)',
        background: 'rgba(251,191,36,0.02)',
    },
    missionGlow: {
        position: 'absolute' as const,
        top: -80, right: -80, width: 300, height: 300,
        borderRadius: '50%',
        opacity: 0.07,
        pointerEvents: 'none' as const,
        filter: 'blur(60px)',
    },
    missionRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
    missionInfo: { flex: 1 },
    statusBadge: {
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
        marginBottom: 10,
    },
    missionTitle: { fontSize: 20, fontWeight: 800, color: '#f4f4f5', margin: '0 0 6px' },
    missionSummary: { fontSize: 14, color: '#a1a1aa', lineHeight: 1.6, margin: 0 },
    // Start button
    startBtn: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '16px 32px', borderRadius: 16, border: 'none',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
        whiteSpace: 'nowrap' as const,
        transition: 'all .2s',
        flexShrink: 0,
    },
    pauseBtn: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '16px 32px', borderRadius: 16, border: 'none',
        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
        color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 8px 32px rgba(239,68,68,0.3)',
        whiteSpace: 'nowrap' as const,
        transition: 'all .2s',
        flexShrink: 0,
    },
    resumeBtn: {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '16px 32px', borderRadius: 16, border: 'none',
        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
        color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 8px 32px rgba(34,197,94,0.3)',
        whiteSpace: 'nowrap' as const,
        transition: 'all .2s',
        flexShrink: 0,
    },
    modelUpgradeBtn: {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '10px 14px', borderRadius: 10,
        border: '1px solid rgba(59,130,246,0.3)',
        background: 'rgba(59,130,246,0.12)',
        color: '#93c5fd', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        transition: 'all .15s',
    },
    // Grid
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
    // Agent card
    agentCard: {
        borderRadius: 16, padding: 20,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
    },
    agentHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
    agentEmoji: { fontSize: 28 },
    agentName: { fontSize: 16, fontWeight: 700, color: '#f4f4f5', margin: 0 },
    agentObjective: { fontSize: 12, color: '#71717a', margin: '2px 0 0', lineHeight: 1.4 },
    taskItem: {
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '8px 10px', borderRadius: 8,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.04)',
        marginBottom: 6,
        fontSize: 12,
    },
    taskName: { color: '#d4d4d8', flex: 1, lineHeight: 1.4 },
    taskStatus: { fontSize: 11, borderRadius: 4, padding: '1px 6px', fontWeight: 600, flexShrink: 0 },
    scoreChip: {
        fontSize: 11, fontWeight: 700,
        borderRadius: 6, padding: '2px 7px',
        background: 'rgba(34,197,94,0.1)',
        color: '#22c55e', flexShrink: 0,
    },
    // Section header
    sectionHeader: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 13, fontWeight: 700, color: '#a1a1aa',
        textTransform: 'uppercase' as const, letterSpacing: 0.8,
        display: 'flex', alignItems: 'center', gap: 8,
    },
    // Proposed objective card
    proposedCard: {
        borderRadius: 14, padding: 18,
        border: '1px solid rgba(99,102,241,0.15)',
        background: 'rgba(99,102,241,0.04)',
        marginBottom: 10,
    },
    proposedHeader: { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
    proposedEmoji: { fontSize: 18, flexShrink: 0 },
    proposedTitle: { fontSize: 14, fontWeight: 700, color: '#c4b5fd', margin: 0, flex: 1 },
    proposedBy: { fontSize: 11, color: '#71717a', margin: '3px 0 0' },
    proposedReason: { fontSize: 13, color: '#a1a1aa', lineHeight: 1.5, margin: '0 0 12px' },
    proposedCountdown: { fontSize: 11, color: '#71717a', marginBottom: 12 },
    proposedActions: { display: 'flex', gap: 8 },
    approveBtn: {
        flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
        background: 'rgba(34,197,94,0.12)',
        color: '#22c55e', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        transition: 'all .15s',
    },
    rejectBtn: {
        flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
        background: 'rgba(239,68,68,0.08)',
        color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        transition: 'all .15s',
    },
    // North Star
    nsCard: {
        borderRadius: 16, padding: 20,
        background: 'rgba(251,191,36,0.04)',
        border: '1px solid rgba(251,191,36,0.12)',
    },
    nsTitle: { fontSize: 18, fontWeight: 800, color: '#fbbf24', margin: '0 0 6px' },
    nsDesc: { fontSize: 13, color: '#a1a1aa', lineHeight: 1.6, margin: '0 0 14px' },
    nsObjective: {
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '8px 12px', borderRadius: 8, marginBottom: 6,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.04)',
        fontSize: 13, color: '#e4e4e7',
    },
    nsDot: { width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', marginTop: 5, flexShrink: 0 },
    // Empty
    emptyState: {
        padding: '32px 20px', textAlign: 'center' as const,
        color: '#52525b', fontSize: 13,
    },
};

/* ─── Main Page ─────────────────────────────────────── */

export default function MissionControlPage() {
    const [mission, setMission] = useState<MissionStatus | null>(null);
    const [northStar, setNorthStar] = useState<NorthStar | null>(null);
    const [proposedObjectives, setProposedObjectives] = useState<ProposedObjective[]>([]);
    const [agentTasks, setAgentTasks] = useState<Record<string, AgentTask[]>>({});
    const [launching, setLaunching] = useState(false);
    const [pausing, setPausing] = useState(false);
    const [queueingModelUpgrade, setQueueingModelUpgrade] = useState(false);
    const [modelUpgradeResult, setModelUpgradeResult] = useState<'success' | 'error' | null>(null);
    const [loadingObjectiveId, setLoadingObjectiveId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [_tick, setTick] = useState(0);
    const [allModelUpgradeTarget, setAllModelUpgradeTarget] = useState(() => {
        return MODEL_UPGRADE_OPTIONS.some((option) => option.value === DEFAULT_MODEL_UPGRADE_TARGET)
            ? DEFAULT_MODEL_UPGRADE_TARGET
            : MODEL_UPGRADE_OPTIONS[0]?.value || '';
    });

    // Tick every 30s for countdown refresh
    useEffect(() => {
        const t = setInterval(() => setTick(x => x + 1), 30000);
        return () => clearInterval(t);
    }, []);

    // Load North Star
    useEffect(() => {
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'company-config/north-star'));
                if (snap.exists()) setNorthStar(snap.data() as NorthStar);
            } catch (e) { console.error(e); }
        })();
    }, []);

    // Live mission status
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'company-config/mission-status'), (snap) => {
            if (snap.exists()) setMission(snap.data() as MissionStatus);
            else setMission({ status: 'idle' });
        });
        return unsub;
    }, []);

    // Live proposed objectives
    useEffect(() => {
        const q = query(
            collection(db, 'northstar-proposed-objectives'),
            where('status', 'in', ['proposed']),
            limit(20)
        );
        const unsub = onSnapshot(q, (snap) => {
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProposedObjective));
            // Sort client-side to avoid composite index requirement
            items.sort((a, b) => {
                const aTime = (a as any).proposedAt?.toMillis?.() ?? 0;
                const bTime = (b as any).proposedAt?.toMillis?.() ?? 0;
                return bTime - aTime;
            });
            setProposedObjectives(items);
        });
        return unsub;
    }, []);

    // Live agent tasks (recent in-progress and todo)
    useEffect(() => {
        const q = query(
            collection(db, 'agent-tasks'),
            where('status', 'in', ['todo', 'in-progress', 'done']),
            limit(100)
        );
        const unsub = onSnapshot(q, (snap) => {
            // Sort client-side to avoid composite index requirement
            const sorted = snap.docs.slice().sort((a, b) => {
                const aTime = a.data().updatedAt?.toMillis?.() ?? 0;
                const bTime = b.data().updatedAt?.toMillis?.() ?? 0;
                return bTime - aTime;
            });
            const byAgent: Record<string, AgentTask[]> = {};
            for (const agent of AGENTS) byAgent[agent.id] = [];
            for (const d of sorted) {
                const data = d.data() as AgentTask;
                const agent = AGENTS.find(a => a.name.toLowerCase() === (data.assignee || '').toLowerCase());
                if (agent) {
                    byAgent[agent.id].push({ ...(data as Omit<AgentTask, 'id'>), id: d.id });
                    if (byAgent[agent.id].length >= 5) break;
                }
            }
            setAgentTasks(byAgent);

        });
        return unsub;
    }, []);

    const handleLaunch = useCallback(async (force = false) => {
        if (!northStar?.title) {
            setError('Set a North Star first. Click the ⭐ in the Virtual Office.');
            return;
        }
        setLaunching(true);
        setError(null);
        try {
            const res = await fetch('/api/agent/kickoff-mission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Launch failed');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLaunching(false);
        }
    }, [northStar]);

    const handlePause = useCallback(async () => {
        setPausing(true);
        setError(null);
        try {
            const res = await fetch('/api/agent/kickoff-mission', { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Pause failed');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setPausing(false);
        }
    }, []);

    const handleQueueModelUpgrade = useCallback(async () => {
        if (queueingModelUpgrade) return;
        const model = allModelUpgradeTarget.trim();
        if (!model) return;

        const confirmed = window.confirm(
            `Queue model upgrade for all core agents to "${model}"?\n\n` +
            'Nora will run the Mac Mini command sequence and restart impacted services.'
        );
        if (!confirmed) return;

        setQueueingModelUpgrade(true);
        setModelUpgradeResult(null);
        setError(null);

        try {
            await presenceService.queueModelUpgrade({
                model,
                scope: 'all',
                requestedBy: 'mission-control',
            });
            setModelUpgradeResult('success');
            setTimeout(() => setModelUpgradeResult(null), 7000);
        } catch (e: any) {
            setModelUpgradeResult('error');
            setError(e?.message || 'Failed to queue model upgrade');
            setTimeout(() => setModelUpgradeResult(null), 7000);
        } finally {
            setQueueingModelUpgrade(false);
        }
    }, [allModelUpgradeTarget, queueingModelUpgrade]);

    const handleObjectiveAction = useCallback(async (id: string, action: 'approved' | 'rejected') => {
        setLoadingObjectiveId(id);
        try {
            await updateDoc(doc(db, 'northstar-proposed-objectives', id), {
                status: action,
                reviewedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoadingObjectiveId(null);
        }
    }, []);

    const missionIsActive = mission?.status === 'active';
    const missionIsPaused = mission?.status === 'paused';
    const missionIsIdle = !mission || mission.status === 'idle';

    const statusColor = missionIsActive ? '#22c55e' : missionIsPaused ? '#fbbf24' : '#71717a';
    const statusLabel = missionIsActive ? '🟢 ACTIVE' : missionIsPaused ? '🟡 PAUSED' : '⚫ IDLE';
    const cardStyle = { ...S.missionCard, ...(missionIsActive ? S.missionCardActive : missionIsPaused ? S.missionCardPaused : S.missionCardIdle) };

    return (
        <>
            <Head>
                <title>Mission Control — Pulse</title>
                <meta name="description" content="Autonomous agent mission control — launch, monitor and guide AI agents toward the North Star." />
            </Head>

            <div style={S.page}>
                {/* ── Header ── */}
                <div style={S.header}>
                    <div style={S.headerTop}>
                        <div style={S.headerLeft}>
                            <div style={S.headerIcon}>
                                <Rocket size={24} color="#fff" />
                            </div>
                            <div>
                                <h1 style={S.pageTitle}>Mission Control</h1>
                                <p style={S.pageSubtitle}>Autonomous agent coordination toward the North Star</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={S.body}>
                    {/* ── Mission Status Card ── */}
                    <div style={cardStyle}>
                        <div style={{ ...S.missionGlow, background: statusColor }} />
                        <div style={S.missionRow}>
                            <div style={S.missionInfo}>
                                <div style={{
                                    ...S.statusBadge,
                                    background: missionIsActive ? 'rgba(34,197,94,0.1)' : missionIsPaused ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.06)',
                                    color: statusColor,
                                }}>
                                    {missionIsActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />}
                                    {statusLabel}
                                    {mission?.startedAt && missionIsActive && (
                                        <span style={{ color: '#71717a', fontWeight: 400 }}>
                                            · started {formatTimeAgo(mission.startedAt)}
                                        </span>
                                    )}
                                </div>

                                {missionIsIdle ? (
                                    <>
                                        <h2 style={S.missionTitle}>No mission running</h2>
                                        <p style={S.missionSummary}>
                                            {northStar?.title
                                                ? `North Star set: "${northStar.title}". Hit Start Mission to launch all agents.`
                                                : 'Set a North Star first in the Virtual Office, then launch a mission.'}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <h2 style={S.missionTitle}>{mission?.northStarTitle || 'Mission Active'}</h2>
                                        <p style={S.missionSummary}>{mission?.missionSummary}</p>
                                        {mission?.taskCount && (
                                            <p style={{ fontSize: 12, color: '#52525b', marginTop: 8 }}>
                                                {mission.taskCount} tasks created across {AGENTS.length} agents
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* ── CTA Button ── */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {missionIsIdle && (
                                    <button
                                        style={S.startBtn}
                                        onClick={() => handleLaunch(false)}
                                        disabled={launching}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(99,102,241,0.6)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.4)'; }}
                                    >
                                        {launching ? <Loader2 size={20} className="spin" /> : <Rocket size={20} />}
                                        {launching ? 'Launching...' : 'Start Mission'}
                                    </button>
                                )}
                                {missionIsActive && (
                                    <button
                                        style={S.pauseBtn}
                                        onClick={handlePause}
                                        disabled={pausing}
                                    >
                                        {pausing ? <Loader2 size={20} /> : <Square size={20} />}
                                        {pausing ? 'Pausing...' : 'Pause Mission'}
                                    </button>
                                )}
                                {missionIsPaused && (
                                    <button
                                        style={S.resumeBtn}
                                        onClick={() => handleLaunch(true)}
                                        disabled={launching}
                                    >
                                        {launching ? <Loader2 size={20} /> : <Rocket size={20} />}
                                        {launching ? 'Launching...' : 'Resume Mission'}
                                    </button>
                                )}
                                {(missionIsActive || missionIsPaused) && (
                                    <button
                                        onClick={() => handleLaunch(true)}
                                        disabled={launching}
                                        style={{
                                            padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                                            background: 'transparent', color: '#71717a', fontSize: 12, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                                        }}
                                    >
                                        <RefreshCw size={14} />
                                        Relaunch with fresh plan
                                    </button>
                                )}
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <select
                                        value={allModelUpgradeTarget}
                                        onChange={(e) => setAllModelUpgradeTarget(e.target.value)}
                                        disabled={queueingModelUpgrade}
                                        title="Select model for upgrading Nora, Scout, Solara, and Sage"
                                        style={{
                                            height: 38,
                                            minWidth: 250,
                                            borderRadius: 10,
                                            border: '1px solid rgba(59,130,246,0.3)',
                                            background: 'rgba(59,130,246,0.12)',
                                            color: '#93c5fd',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            padding: '0 10px',
                                        }}
                                    >
                                        {MODEL_UPGRADE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleQueueModelUpgrade}
                                        disabled={queueingModelUpgrade}
                                        title="Queue a model upgrade task for Nora to execute on the Mac Mini"
                                        style={{
                                            ...S.modelUpgradeBtn,
                                            ...(modelUpgradeResult === 'success'
                                                ? {
                                                    border: '1px solid rgba(34,197,94,0.35)',
                                                    background: 'rgba(34,197,94,0.14)',
                                                    color: '#4ade80',
                                                }
                                                : modelUpgradeResult === 'error'
                                                    ? {
                                                        border: '1px solid rgba(239,68,68,0.35)',
                                                        background: 'rgba(239,68,68,0.14)',
                                                        color: '#f87171',
                                                    }
                                                    : {}),
                                            opacity: queueingModelUpgrade ? 0.8 : 1,
                                        }}
                                    >
                                        {queueingModelUpgrade
                                            ? <Loader2 size={14} className="spin" />
                                            : modelUpgradeResult === 'success'
                                                ? <CheckCircle2 size={14} />
                                                : modelUpgradeResult === 'error'
                                                    ? <XCircle size={14} />
                                                    : <Zap size={14} />
                                        }
                                        {queueingModelUpgrade
                                            ? 'Queueing model upgrade...'
                                            : modelUpgradeResult === 'success'
                                                ? 'Model upgrade queued'
                                                : modelUpgradeResult === 'error'
                                                    ? 'Model upgrade failed'
                                                    : 'Upgrade agent models'
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div style={{
                                marginTop: 16, padding: '12px 16px', borderRadius: 10,
                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                                color: '#f87171', fontSize: 13,
                            }}>
                                <AlertTriangle size={14} style={{ display: 'inline', marginRight: 6 }} />
                                {error}
                            </div>
                        )}
                    </div>

                    <div style={S.grid2}>
                        {/* Left column: North Star + Agent status */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* North Star */}
                            {northStar?.title && (
                                <div style={S.nsCard}>
                                    <div style={S.sectionHeader}>
                                        <span style={S.sectionTitle}>
                                            <Star size={14} color="#fbbf24" />
                                            North Star
                                        </span>
                                    </div>
                                    <h3 style={S.nsTitle}>{northStar.title}</h3>
                                    {northStar.description && (
                                        <p style={S.nsDesc}>{northStar.description.substring(0, 200)}{northStar.description.length > 200 ? '…' : ''}</p>
                                    )}
                                    {(northStar.objectives || []).length > 0 && (
                                        <div>
                                            {northStar.objectives!.map((obj, i) => (
                                                <div key={i} style={S.nsObjective}>
                                                    <div style={S.nsDot} />
                                                    {obj}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Agent objective claims */}
                            {missionIsActive && mission?.agentObjectives && (
                                <div>
                                    <div style={{ ...S.sectionTitle, marginBottom: 14 }}>
                                        <Users size={14} />
                                        Agent Objectives
                                    </div>
                                    {AGENTS.map(agent => {
                                        const obj = mission.agentObjectives?.[agent.id];
                                        if (!obj) return null;
                                        return (
                                            <div key={agent.id} style={{
                                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                                padding: '10px 14px', borderRadius: 10, marginBottom: 8,
                                                background: 'rgba(255,255,255,0.02)',
                                                border: `1px solid ${agent.color}22`,
                                            }}>
                                                <span style={{ fontSize: 18, flexShrink: 0 }}>{agent.emoji}</span>
                                                <div>
                                                    <p style={{ fontSize: 13, fontWeight: 600, color: agent.color, margin: 0 }}>{agent.name}</p>
                                                    <p style={{ fontSize: 12, color: '#a1a1aa', margin: '2px 0 0', lineHeight: 1.4 }}>{obj}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Right column: Proposed objectives */}
                        <div>
                            <div style={S.sectionHeader}>
                                <span style={S.sectionTitle}>
                                    <Brain size={14} color="#818cf8" />
                                    Agent-Proposed Objectives
                                    {proposedObjectives.length > 0 && (
                                        <span style={{
                                            background: '#6366f1', color: '#fff',
                                            borderRadius: 10, padding: '1px 8px', fontSize: 11,
                                        }}>{proposedObjectives.length}</span>
                                    )}
                                </span>
                            </div>

                            {proposedObjectives.length === 0 ? (
                                <div style={S.emptyState}>
                                    <Brain size={28} style={{ marginBottom: 10, opacity: 0.3 }} />
                                    <p style={{ margin: 0 }}>No proposed objectives yet.<br />Agents will suggest new objectives as they work.</p>
                                </div>
                            ) : (
                                proposedObjectives.map(obj => (
                                    <div key={obj.id} style={S.proposedCard}>
                                        <div style={S.proposedHeader}>
                                            <span style={S.proposedEmoji}>{obj.proposedByEmoji || '💡'}</span>
                                            <div style={{ flex: 1 }}>
                                                <p style={S.proposedTitle}>{obj.title}</p>
                                                <p style={S.proposedBy}>Proposed by {obj.proposedByName} · {formatTimeAgo(obj.proposedAt)}</p>
                                            </div>
                                        </div>
                                        <p style={S.proposedReason}>{obj.reason}</p>
                                        {obj.autoApproveAt && (
                                            <p style={S.proposedCountdown}>
                                                <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                                                {formatAutoApproveCountdown(obj.autoApproveAt)}
                                            </p>
                                        )}
                                        <div style={S.proposedActions}>
                                            <button
                                                style={S.approveBtn}
                                                onClick={() => handleObjectiveAction(obj.id, 'approved')}
                                                disabled={loadingObjectiveId === obj.id}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.2)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.12)'; }}
                                            >
                                                <CheckCircle2 size={13} />
                                                Approve
                                            </button>
                                            <button
                                                style={S.rejectBtn}
                                                onClick={() => handleObjectiveAction(obj.id, 'rejected')}
                                                disabled={loadingObjectiveId === obj.id}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.16)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                                            >
                                                <XCircle size={13} />
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* ── Agent Work Feed ── */}
                    <div>
                        <div style={{ ...S.sectionTitle, marginBottom: 16 }}>
                            <Activity size={14} color="#22d3ee" />
                            Agent Work Feed
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                            {AGENTS.map(agent => {
                                const tasks = agentTasks[agent.id] || [];
                                const inProgress = tasks.filter(t => t.status === 'in-progress');
                                const todo = tasks.filter(t => t.status === 'todo');
                                const done = tasks.filter(t => t.status === 'done').slice(0, 2);
                                const allVisible = [...inProgress, ...todo, ...done].slice(0, 5);

                                return (
                                    <div key={agent.id} style={S.agentCard}>
                                        <div style={S.agentHeader}>
                                            <span style={S.agentEmoji}>{agent.emoji}</span>
                                            <div>
                                                <p style={{ ...S.agentName, color: agent.color }}>{agent.name}</p>
                                                <p style={S.agentObjective}>
                                                    {inProgress.length > 0 ? `${inProgress.length} in progress` :
                                                        todo.length > 0 ? `${todo.length} queued` : 'Idle'}
                                                </p>
                                            </div>
                                        </div>

                                        {allVisible.length === 0 ? (
                                            <div style={{ ...S.emptyState, padding: '16px 8px' }}>
                                                <Zap size={18} style={{ opacity: 0.2, marginBottom: 6 }} />
                                                <span>No active tasks</span>
                                            </div>
                                        ) : (
                                            allVisible.map(task => (
                                                <div key={task.id} style={S.taskItem}>
                                                    <div style={{ flexShrink: 0, marginTop: 1 }}>
                                                        {task.status === 'in-progress' && <Loader2 size={11} color={agent.color} />}
                                                        {task.status === 'todo' && <div style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px solid #52525b`, marginTop: 1 }} />}
                                                        {task.status === 'done' && <CheckCircle2 size={11} color="#22c55e" />}
                                                    </div>
                                                    <span style={{
                                                        ...S.taskName,
                                                        color: task.status === 'done' ? '#52525b' : '#d4d4d8',
                                                        textDecoration: task.status === 'done' ? 'line-through' : 'none',
                                                    }}>
                                                        {task.name}
                                                    </span>
                                                    {task.northStarScore && (
                                                        <span style={{ ...S.scoreChip, background: task.northStarScore >= 7 ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)', color: task.northStarScore >= 7 ? '#22c55e' : '#fbbf24' }}>
                                                            {task.northStarScore}/10
                                                        </span>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                * { box-sizing: border-box; }
                body { margin: 0; background: #080811; }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
                @media (max-width: 1024px) {
                    .grid2 { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </>
    );
}
