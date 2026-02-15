import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
    AlertTriangle, Send, X, Clock, ChevronDown,
    ShieldAlert, Wrench, HelpCircle,
} from 'lucide-react';
import { db } from '../../api/firebase/config';
import {
    collection, query, where, orderBy,
    onSnapshot, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';

/* ─── Types ───────────────────────────────────────────── */

interface Intervention {
    id: string;
    agentId: string;
    agentName: string;
    question: string;
    context: string;
    taskId: string;
    taskName: string;
    category: string;
    status: 'pending' | 'resolved' | 'dismissed' | 'expired';
    response?: string;
    createdAt?: Date;
}

/* ─── Constants ───────────────────────────────────────── */

const AGENT_EMOJIS: Record<string, string> = {
    nora: '⚡', antigravity: '🌌', scout: '🕵️', solara: '❤️‍🔥', sage: '🧬',
};

const AGENT_NAMES: Record<string, string> = {
    nora: 'Nora', antigravity: 'Antigravity', scout: 'Scout', solara: 'Solara', sage: 'Sage',
};

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    PERMISSION: { icon: <ShieldAlert className="w-4 h-4" />, label: 'Permission Required', color: '#f59e0b' },
    MISSING_TOOL: { icon: <Wrench className="w-4 h-4" />, label: 'Missing Tool', color: '#ef4444' },
    unknown: { icon: <HelpCircle className="w-4 h-4" />, label: 'Help Needed', color: '#818cf8' },
};

/* ─── Styles ──────────────────────────────────────────── */

const styles = {
    container: {
        position: 'fixed' as const,
        bottom: 24,
        right: 24,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 12,
        maxWidth: 420,
        width: '100%',
        pointerEvents: 'none' as const,
    },
    card: {
        pointerEvents: 'auto' as const,
        background: 'linear-gradient(135deg, rgba(15, 15, 25, 0.98), rgba(20, 20, 35, 0.96))',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(245, 158, 11, 0.15)',
        overflow: 'hidden',
        animation: 'interventionSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    agentAvatar: {
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: 'rgba(245, 158, 11, 0.15)',
        border: '2px solid rgba(245, 158, 11, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        animation: 'interventionPulse 2s ease-in-out infinite',
    },
    agentName: {
        fontSize: 14,
        fontWeight: 600,
        color: '#e4e4e7',
        fontFamily: 'Inter, -apple-system, sans-serif',
    },
    badge: {
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        padding: '2px 8px',
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
    },
    closeBtn: {
        background: 'none',
        border: 'none',
        color: '#71717a',
        cursor: 'pointer',
        padding: 4,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'color 0.15s',
    },
    body: {
        padding: '12px 16px',
    },
    question: {
        fontSize: 13,
        lineHeight: 1.5,
        color: '#d4d4d8',
        fontFamily: 'Inter, -apple-system, sans-serif',
        marginBottom: 8,
        whiteSpace: 'pre-wrap' as const,
    },
    context: {
        fontSize: 11,
        color: '#71717a',
        fontFamily: 'JetBrains Mono, monospace',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 8,
        padding: '8px 10px',
        maxHeight: 80,
        overflow: 'auto',
        marginBottom: 12,
        whiteSpace: 'pre-wrap' as const,
        border: '1px solid rgba(255,255,255,0.04)',
    },
    taskName: {
        fontSize: 11,
        color: '#52525b',
        fontFamily: 'Inter, -apple-system, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginBottom: 12,
    },
    inputRow: {
        display: 'flex',
        gap: 8,
        padding: '0 16px 14px',
    },
    input: {
        flex: 1,
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: '8px 12px',
        color: '#e4e4e7',
        fontSize: 13,
        fontFamily: 'Inter, -apple-system, sans-serif',
        outline: 'none',
        transition: 'border-color 0.15s',
    },
    sendBtn: {
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        border: 'none',
        borderRadius: 10,
        padding: '8px 14px',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'Inter, -apple-system, sans-serif',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap' as const,
    },
    dismissBtn: {
        background: 'none',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '8px 12px',
        color: '#71717a',
        cursor: 'pointer',
        fontSize: 12,
        fontFamily: 'Inter, -apple-system, sans-serif',
        transition: 'all 0.15s',
    },
    timer: {
        fontSize: 10,
        color: '#52525b',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 16px 10px',
    },
} as const;

const keyframesStyle = `
@keyframes interventionSlideIn {
    from {
        opacity: 0;
        transform: translateX(100px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateX(0) scale(1);
    }
}
@keyframes interventionPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
}
@keyframes interventionGlow {
    0%, 100% { border-color: rgba(245, 158, 11, 0.4); }
    50% { border-color: rgba(245, 158, 11, 0.8); }
}
`;

/* ─── Single Intervention Card ────────────────────────── */

const InterventionCard: React.FC<{
    intervention: Intervention;
    onRespond: (id: string, response: string) => void;
    onDismiss: (id: string) => void;
}> = ({ intervention, onRespond, onDismiss }) => {
    const [response, setResponse] = useState('');
    const [sending, setSending] = useState(false);
    const [showContext, setShowContext] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [elapsed, setElapsed] = useState('');

    const cat = CATEGORY_CONFIG[intervention.category] || CATEGORY_CONFIG.unknown;
    const emoji = AGENT_EMOJIS[intervention.agentId] || '🤖';
    const name = AGENT_NAMES[intervention.agentId] || intervention.agentName || intervention.agentId;

    // Elapsed time ticker
    useEffect(() => {
        const tick = () => {
            if (!intervention.createdAt) return;
            const ms = Date.now() - intervention.createdAt.getTime();
            if (ms < 60_000) setElapsed(`${Math.floor(ms / 1000)}s ago`);
            else if (ms < 3_600_000) setElapsed(`${Math.floor(ms / 60_000)}m ago`);
            else setElapsed(`${Math.floor(ms / 3_600_000)}h ago`);
        };
        tick();
        const iv = setInterval(tick, 10_000);
        return () => clearInterval(iv);
    }, [intervention.createdAt]);

    const handleSend = async () => {
        if (!response.trim() || sending) return;
        setSending(true);
        await onRespond(intervention.id, response.trim());
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div style={{
            ...styles.card,
            borderColor: `${cat.color}66`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 24px ${cat.color}22`,
            animation: 'interventionSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1), interventionGlow 3s ease-in-out infinite',
        }}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <div style={{
                        ...styles.agentAvatar,
                        borderColor: `${cat.color}88`,
                        background: `${cat.color}22`,
                    }}>
                        {emoji}
                    </div>
                    <div>
                        <div style={styles.agentName}>{name} needs help</div>
                        <div style={{
                            ...styles.badge,
                            background: `${cat.color}22`,
                            color: cat.color,
                            border: `1px solid ${cat.color}44`,
                        }}>
                            {cat.icon} {cat.label}
                        </div>
                    </div>
                </div>
                <button
                    style={styles.closeBtn}
                    onClick={() => onDismiss(intervention.id)}
                    title="Dismiss"
                    onMouseOver={e => (e.currentTarget.style.color = '#a1a1aa')}
                    onMouseOut={e => (e.currentTarget.style.color = '#71717a')}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Body */}
            <div style={styles.body}>
                {/* Task context */}
                {intervention.taskName && (
                    <div style={styles.taskName}>
                        <AlertTriangle className="w-3 h-3" style={{ color: cat.color }} />
                        Task: {intervention.taskName}
                    </div>
                )}

                {/* Question */}
                <div style={styles.question}>
                    {intervention.question.length > 300
                        ? intervention.question.substring(0, 300) + '…'
                        : intervention.question}
                </div>

                {/* Expandable context */}
                {intervention.context && (
                    <>
                        <button
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#52525b',
                                cursor: 'pointer',
                                fontSize: 11,
                                fontFamily: 'Inter, -apple-system, sans-serif',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: 0,
                                marginBottom: showContext ? 6 : 0,
                            }}
                            onClick={() => setShowContext(!showContext)}
                        >
                            <ChevronDown
                                className="w-3 h-3"
                                style={{
                                    transform: showContext ? 'rotate(180deg)' : 'rotate(0)',
                                    transition: 'transform 0.2s',
                                }}
                            />
                            {showContext ? 'Hide' : 'Show'} error context
                        </button>
                        {showContext && (
                            <div style={styles.context}>
                                {intervention.context}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Input Row */}
            <div style={styles.inputRow}>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Type your response…"
                    value={response}
                    onChange={e => setResponse(e.target.value)}
                    onKeyDown={handleKeyDown}
                    style={styles.input}
                    onFocus={e => (e.currentTarget.style.borderColor = `${cat.color}88`)}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                    disabled={sending}
                />
                <button
                    style={{
                        ...styles.sendBtn,
                        background: sending
                            ? 'rgba(245, 158, 11, 0.3)'
                            : `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)`,
                        opacity: (!response.trim() || sending) ? 0.5 : 1,
                        cursor: (!response.trim() || sending) ? 'not-allowed' : 'pointer',
                    }}
                    onClick={handleSend}
                    disabled={!response.trim() || sending}
                >
                    <Send className="w-3.5 h-3.5" />
                    {sending ? 'Sending…' : 'Respond'}
                </button>
            </div>

            {/* Timer */}
            <div style={styles.timer}>
                <Clock className="w-3 h-3" />
                Waiting {elapsed} · Agent is paused
            </div>
        </div>
    );
};

/* ─── Main InterventionAlert Component ────────────────── */

export const InterventionAlert: React.FC = () => {
    const [interventions, setInterventions] = useState<Intervention[]>([]);

    // Listen for pending interventions
    useEffect(() => {
        const q = query(
            collection(db, 'agent-interventions'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc'),
        );

        const unsub = onSnapshot(q, (snap) => {
            const items: Intervention[] = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    agentId: data.agentId || '',
                    agentName: data.agentName || data.agentId || '',
                    question: data.question || '',
                    context: data.context || '',
                    taskId: data.taskId || '',
                    taskName: data.taskName || '',
                    category: data.category || 'unknown',
                    status: data.status,
                    createdAt: data.createdAt?.toDate?.() || new Date(),
                };
            });
            setInterventions(items);
        });

        return () => unsub();
    }, []);

    const handleRespond = async (id: string, response: string) => {
        try {
            await updateDoc(doc(db, 'agent-interventions', id), {
                status: 'resolved',
                response,
                resolvedAt: serverTimestamp(),
            });
        } catch (err) {
            console.error('Failed to respond to intervention:', err);
        }
    };

    const handleDismiss = async (id: string) => {
        try {
            await updateDoc(doc(db, 'agent-interventions', id), {
                status: 'dismissed',
                resolvedAt: serverTimestamp(),
            });
        } catch (err) {
            console.error('Failed to dismiss intervention:', err);
        }
    };

    if (interventions.length === 0) return null;

    return ReactDOM.createPortal(
        <>
            <style>{keyframesStyle}</style>
            <div style={styles.container}>
                {interventions.map(iv => (
                    <InterventionCard
                        key={iv.id}
                        intervention={iv}
                        onRespond={handleRespond}
                        onDismiss={handleDismiss}
                    />
                ))}
            </div>
        </>,
        document.body
    );
};

export default InterventionAlert;
