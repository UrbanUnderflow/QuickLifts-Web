import React, { useState, useEffect, CSSProperties } from 'react';
import ReactDOM from 'react-dom';
import { X, Star, Save, Edit3, Target, Compass, CheckCircle2, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { db } from '../../api/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

/* ─── Types ─────────────────────────────────────────── */

interface NorthStarData {
    title: string;
    description: string;
    objectives: string[];
    updatedAt?: any;
    updatedBy?: string;
}

const DEFAULT_NORTH_STAR: NorthStarData = {
    title: '',
    description: '',
    objectives: [],
};

const DOC_PATH = 'company-config/north-star';

/* ─── Styles ────────────────────────────────────────── */

const S: Record<string, CSSProperties> = {
    overlay: {
        position: 'fixed', inset: 0, zIndex: 9998,
        display: 'flex', justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    },
    panel: {
        width: 480, maxWidth: '94vw', height: '100vh',
        background: '#0c0c18',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-16px 0 64px rgba(0,0,0,0.6)',
    },
    header: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '22px 20px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: 14 },
    headerIcon: {
        width: 44, height: 44, borderRadius: 14,
        background: 'linear-gradient(135deg, #78350f, #451a03)',
        border: '1px solid rgba(251,191,36,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fbbf24', fontSize: 20,
    },
    headerTitle: { fontSize: 17, fontWeight: 700, color: '#f4f4f5', margin: 0 },
    headerSub: { fontSize: 11, color: '#71717a', margin: '2px 0 0' },
    closeBtn: {
        width: 34, height: 34, borderRadius: 8,
        border: 'none', background: 'rgba(255,255,255,0.04)',
        color: '#71717a', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .15s',
    },
    body: { flex: 1, overflowY: 'auto', padding: '20px 20px 24px' },
    loading: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '60px 20px', color: '#52525b', fontSize: 13,
    },
    emptyState: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px', textAlign: 'center',
    },
    emptyIcon: { fontSize: 48, marginBottom: 16, filter: 'grayscale(0.3)' },
    emptyTitle: { fontSize: 16, fontWeight: 700, color: '#e4e4e7', margin: '0 0 6px' },
    emptySub: { fontSize: 13, color: '#71717a', lineHeight: 1.5, maxWidth: 300 },
    emptyBtn: {
        marginTop: 20, padding: '10px 24px', borderRadius: 10, border: 'none',
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
    },
    // View mode
    viewCard: {
        borderRadius: 16, padding: 20,
        background: 'rgba(251,191,36,0.04)',
        border: '1px solid rgba(251,191,36,0.12)',
        marginBottom: 16,
    },
    viewTitle: {
        fontSize: 22, fontWeight: 800, color: '#fbbf24', margin: '0 0 4px',
        lineHeight: 1.3,
    },
    viewUpdated: { fontSize: 11, color: '#71717a', margin: '0 0 14px' },
    viewDescription: {
        fontSize: 14, color: '#d4d4d8', lineHeight: 1.7, margin: 0,
        whiteSpace: 'pre-wrap',
    },
    objectivesSection: { marginTop: 20 },
    objectivesHeader: {
        fontSize: 11, fontWeight: 700, color: '#a1a1aa',
        textTransform: 'uppercase' as const, letterSpacing: 0.6,
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 12,
    },
    objectiveItem: {
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 14px', borderRadius: 10,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        marginBottom: 6,
    },
    objectiveDot: {
        width: 8, height: 8, borderRadius: '50%',
        background: '#fbbf24', marginTop: 5, flexShrink: 0,
    },
    objectiveText: { fontSize: 13, color: '#e4e4e7', lineHeight: 1.5 },
    editBtn: {
        marginTop: 16, padding: '10px 20px', borderRadius: 10,
        border: '1px solid rgba(251,191,36,0.2)',
        background: 'rgba(251,191,36,0.08)',
        color: '#fbbf24', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'all .15s',
    },
    // Edit mode
    label: {
        fontSize: 11, fontWeight: 700, color: '#a1a1aa',
        textTransform: 'uppercase' as const, letterSpacing: 0.6,
        marginBottom: 6, display: 'block',
    },
    input: {
        width: '100%', padding: '12px 14px', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
        color: '#e4e4e7', fontSize: 16, fontWeight: 700,
        outline: 'none', transition: 'border-color .15s',
        boxSizing: 'border-box' as const,
    },
    textarea: {
        width: '100%', padding: '12px 14px', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
        color: '#d4d4d8', fontSize: 14, lineHeight: 1.7,
        outline: 'none', resize: 'vertical' as const,
        minHeight: 160, transition: 'border-color .15s',
        fontFamily: 'inherit',
        boxSizing: 'border-box' as const,
    },
    fieldGroup: { marginBottom: 20 },
    objectiveInputRow: {
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
    },
    objectiveInput: {
        flex: 1, padding: '10px 12px', borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
        color: '#e4e4e7', fontSize: 13, outline: 'none',
        boxSizing: 'border-box' as const,
    },
    removeBtn: {
        width: 30, height: 30, borderRadius: 8,
        border: 'none', background: 'rgba(239,68,68,0.1)',
        color: '#f87171', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
    },
    addObjectiveBtn: {
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 8,
        border: '1px dashed rgba(255,255,255,0.1)',
        background: 'transparent', color: '#71717a', fontSize: 12,
        cursor: 'pointer', transition: 'all .15s',
    },
    footer: {
        display: 'flex', gap: 8,
        padding: '14px 20px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
    },
    cancelBtn: {
        flex: 1, padding: 12, borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'transparent', color: '#71717a',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
    },
    saveBtn: {
        flex: 1, padding: 12, borderRadius: 10, border: 'none',
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        transition: 'all .15s',
    },
    savedBtn: {
        flex: 1, padding: 12, borderRadius: 10, border: 'none',
        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
        color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    },
    hint: {
        marginTop: 20, padding: '14px 16px', borderRadius: 12,
        background: 'rgba(99,102,241,0.06)',
        border: '1px solid rgba(99,102,241,0.12)',
        fontSize: 12, color: '#a1a1aa', lineHeight: 1.6,
        display: 'flex', gap: 10, alignItems: 'flex-start',
    },
    hintIcon: { flexShrink: 0, color: '#818cf8', marginTop: 1 },
};

/* ─── Component ─────────────────────────────────────── */

interface NorthStarPanelProps {
    onClose: () => void;
}

export const NorthStarPanel: React.FC<NorthStarPanelProps> = ({ onClose }) => {
    const [data, setData] = useState<NorthStarData>(DEFAULT_NORTH_STAR);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [draft, setDraft] = useState<NorthStarData>(DEFAULT_NORTH_STAR);

    useEffect(() => {
        (async () => {
            try {
                const snap = await getDoc(doc(db, DOC_PATH));
                if (snap.exists()) {
                    const d = snap.data() as NorthStarData;
                    setData(d);
                    setDraft(d);
                }
            } catch (err) {
                console.error('Failed to load North Star:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const cleaned = {
                ...draft,
                objectives: draft.objectives.filter(o => o.trim()),
                updatedAt: serverTimestamp(),
                updatedBy: 'admin',
            };
            await setDoc(doc(db, DOC_PATH), cleaned);
            setData(cleaned);
            setSaved(true);
            setEditing(false);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) {
            console.error('Failed to save North Star:', err);
        } finally {
            setSaving(false);
        }
    };

    const startEditing = () => {
        setDraft({ ...data });
        setEditing(true);
    };

    const cancelEditing = () => {
        setDraft({ ...data });
        setEditing(false);
    };

    const updateObjective = (index: number, value: string) => {
        setDraft(prev => {
            const objectives = [...prev.objectives];
            objectives[index] = value;
            return { ...prev, objectives };
        });
    };

    const addObjective = () => {
        setDraft(prev => ({ ...prev, objectives: [...prev.objectives, ''] }));
    };

    const removeObjective = (index: number) => {
        setDraft(prev => ({
            ...prev,
            objectives: prev.objectives.filter((_, i) => i !== index),
        }));
    };

    const hasContent = data.title || data.description;
    const updatedLabel = data.updatedAt?.toDate
        ? `Last updated ${data.updatedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : data.updatedAt
            ? 'Recently updated'
            : '';

    /* ─── View Mode ─── */
    const renderView = () => {
        if (!hasContent) {
            return (
                <div style={S.emptyState}>
                    <div style={S.emptyIcon}>⭐</div>
                    <h3 style={S.emptyTitle}>No North Star Set</h3>
                    <p style={S.emptySub}>
                        Define your company's current focus and main initiative.
                        Your agents will reference this during standups, brainstorming,
                        and task planning.
                    </p>
                    <button style={S.emptyBtn} onClick={startEditing}>
                        <Star size={14} />
                        Set North Star
                    </button>
                </div>
            );
        }

        return (
            <>
                <div style={S.viewCard}>
                    <h2 style={S.viewTitle}>{data.title}</h2>
                    {updatedLabel && <p style={S.viewUpdated}>{updatedLabel}</p>}
                    <p style={S.viewDescription}>{data.description}</p>
                </div>

                {data.objectives && data.objectives.length > 0 && (
                    <div style={S.objectivesSection}>
                        <div style={S.objectivesHeader}>
                            <Target size={13} />
                            Key Objectives ({data.objectives.length})
                        </div>
                        {data.objectives.map((obj, i) => (
                            <div key={i} style={S.objectiveItem}>
                                <div style={S.objectiveDot} />
                                <span style={S.objectiveText}>{obj}</span>
                            </div>
                        ))}
                    </div>
                )}

                <button
                    style={S.editBtn}
                    onClick={startEditing}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.08)'; }}
                >
                    <Edit3 size={14} />
                    Edit North Star
                </button>

                <div style={S.hint}>
                    <Compass size={14} style={S.hintIcon as any} />
                    <div>
                        <strong style={{ color: '#c4b5fd' }}>How this is used:</strong><br />
                        Your agents see this North Star during standups, brainstorming rounds,
                        and when planning tasks. It keeps everyone aligned on what matters most.
                    </div>
                </div>
            </>
        );
    };

    /* ─── Edit Mode ─── */
    const renderEdit = () => (
        <>
            <div style={S.fieldGroup}>
                <label style={S.label}>North Star Title</label>
                <input
                    style={S.input}
                    placeholder='e.g. "Launch Android v2.0" or "Hit 10K MAU"'
                    value={draft.title}
                    onChange={e => setDraft(prev => ({ ...prev, title: e.target.value }))}
                    onFocus={e => { e.target.style.borderColor = 'rgba(251,191,36,0.4)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                />
            </div>

            <div style={S.fieldGroup}>
                <label style={S.label}>Description / Write-up</label>
                <textarea
                    style={S.textarea as any}
                    placeholder="Write a detailed description of your current focus. What's the initiative? Why does it matter? What does success look like? The more context you provide, the better your agents can align their work."
                    value={draft.description}
                    onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
                    onFocus={e => { e.target.style.borderColor = 'rgba(251,191,36,0.4)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                />
            </div>

            <div style={S.fieldGroup}>
                <label style={S.label}>Key Objectives / Milestones</label>
                {draft.objectives.map((obj, i) => (
                    <div key={i} style={S.objectiveInputRow}>
                        <input
                            style={S.objectiveInput}
                            placeholder={`Objective ${i + 1}`}
                            value={obj}
                            onChange={e => updateObjective(i, e.target.value)}
                            onFocus={e => { e.target.style.borderColor = 'rgba(251,191,36,0.4)'; }}
                            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                        />
                        <button style={S.removeBtn} onClick={() => removeObjective(i)}>
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}
                <button
                    style={S.addObjectiveBtn}
                    onClick={addObjective}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(251,191,36,0.3)'; e.currentTarget.style.color = '#fbbf24'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#71717a'; }}
                >
                    <Plus size={12} />
                    Add Objective
                </button>
            </div>

            <div style={S.hint}>
                <AlertTriangle size={14} style={S.hintIcon as any} />
                <div>
                    <strong style={{ color: '#fbbf24' }}>Tip:</strong> Be specific about what success looks like.
                    Instead of "grow the app," try "launch Android v2.0 with social features and reach 500 DAU by March."
                    Agents will use this to prioritize their work.
                </div>
            </div>
        </>
    );

    const panel = (
        <div style={S.overlay} onClick={onClose}>
            <div style={S.panel} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={S.header}>
                    <div style={S.headerLeft}>
                        <div style={S.headerIcon}>⭐</div>
                        <div>
                            <h2 style={S.headerTitle}>North Star</h2>
                            <p style={S.headerSub}>Company focus &amp; initiative</p>
                        </div>
                    </div>
                    <button
                        style={S.closeBtn}
                        onClick={onClose}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#d4d4d8'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#71717a'; }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div style={S.body}>
                    {loading ? (
                        <div style={S.loading}>
                            <div style={{
                                width: 28, height: 28,
                                border: '2px solid rgba(251,191,36,0.15)',
                                borderTopColor: '#fbbf24',
                                borderRadius: '50%',
                                animation: 'spin .7s linear infinite',
                                marginBottom: 12,
                            }} />
                            <p>Loading North Star…</p>
                        </div>
                    ) : editing ? renderEdit() : renderView()}
                </div>

                {/* Footer (only in edit mode) */}
                {editing && !loading && (
                    <div style={S.footer}>
                        <button style={S.cancelBtn} onClick={cancelEditing}>Cancel</button>
                        <button
                            style={saved ? S.savedBtn : S.saveBtn}
                            onClick={handleSave}
                            disabled={saving || !draft.title.trim()}
                            onMouseEnter={e => { if (!saving) e.currentTarget.style.filter = 'brightness(1.15)'; }}
                            onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}
                        >
                            {saving ? 'Saving…' : saved ? '✓ Saved' : (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                                    <Save size={14} />
                                    Save North Star
                                </span>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return ReactDOM.createPortal(panel, document.body);
};

export default NorthStarPanel;
