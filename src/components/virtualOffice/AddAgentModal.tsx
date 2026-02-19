import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
    X, UserPlus, Sparkles, Monitor, ChevronRight,
    Loader2, CheckCircle2, Lock,
} from 'lucide-react';
import { groupChatService } from '../../api/firebase/groupChat/service';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

/* ─── Types ───────────────────────────────────────────── */

interface AddAgentModalProps {
    onClose: () => void;
    onStartBrainstorm: (chatId: string, participants: string[], agentMeta: AgentDraft) => void;
}

export interface AgentDraft {
    name: string;
    id: string;
    emoji: string;
    device: string;
}

type Step = 'form' | 'creating';

/* ─── Device options ──────────────────────────────────── */

const DEVICES = [
    {
        id: 'mac-mini-nora',
        label: 'MacMini — noraclawdbot',
        description: 'Primary agent host (Nora, Scout, Solara, Sage)',
        icon: '🖥️',
    },
];

/* ─── Emoji picker (quick-select) ─────────────────────── */

const EMOJI_OPTIONS = [
    '🔮', '🌊', '🦊', '🛡️', '🎯', '📡', '🧭', '🌀',
    '⚔️', '🔬', '🎪', '🌿', '💎', '🦉', '🧊', '🔥',
    '🪐', '🎭', '⚗️', '🌸', '🧠', '🦅', '🌙', '🗡️',
];

/* ─── Component ───────────────────────────────────────── */

export const AddAgentModal: React.FC<AddAgentModalProps> = ({ onClose, onStartBrainstorm }) => {
    const [step, setStep] = useState<Step>('form');
    const [name, setName] = useState('');
    const [emoji, setEmoji] = useState('🔮');
    const [device, setDevice] = useState(DEVICES[0].id);
    const [error, setError] = useState('');

    const agentId = name.toLowerCase().replace(/[^a-z0-9]/g, '');

    const EXISTING_AGENTS = ['nora', 'scout', 'solara', 'sage', 'antigravity'];

    const validate = useCallback(() => {
        if (!name.trim()) return 'Agent name is required';
        if (name.trim().length < 2) return 'Name must be at least 2 characters';
        if (!/^[a-zA-Z]/.test(name.trim())) return 'Name must start with a letter';
        if (EXISTING_AGENTS.includes(agentId)) return `"${name}" already exists`;
        if (!emoji) return 'Pick an emoji';
        return '';
    }, [name, emoji, agentId]);

    const handleSubmit = useCallback(async () => {
        const err = validate();
        if (err) { setError(err); return; }
        setError('');
        setStep('creating');

        try {
            // Create a special onboarding group chat with all existing agents
            const participants = EXISTING_AGENTS.filter(a => a !== 'antigravity');
            const chatId = await groupChatService.createSession(participants);

            // Seed the brainstorm with the onboarding prompt
            const displayName = name.trim().charAt(0).toUpperCase() + name.trim().slice(1);

            const seedPrompt = [
                `🆕 AGENT ONBOARDING BRAINSTORM — Welcome ${emoji} ${displayName}`,
                ``,
                `We're adding a new team member to the Pulse Round Table. Their name is **${displayName}** ${emoji}.`,
                ``,
                `Your mission: collaboratively define who ${displayName} is. By the end of this conversation,`,
                `we need full agreement on every section of their soul file:`,
                ``,
                `1. **Who They Are** — Role title, 2-3 sentence identity (what they do, how they operate)`,
                `2. **Their Beliefs** — 4-6 core beliefs that guide their work (format: "I believe X because Y")`,
                `3. **What They Refuse To Do** — 3-5 anti-patterns they reject`,
                `4. **Their Productive Flaw** — The one flaw that makes them better at their job`,
                `5. **How They Think** — Their cognitive approach in 3-5 patterns`,
                ``,
                `Guidelines:`,
                `- Think about what GAP exists on the team that ${displayName} would fill`,
                `- Their role should complement, not duplicate, existing team members`,
                `- Be specific — "I research market trends" is generic; "I map the invisible connections between creator burnout patterns and platform engagement loops" is a soul`,
                `- Each agent should contribute at least one suggestion per section`,
                `- When you've reached consensus on ALL 5 sections, present the final soul in a structured format`,
                ``,
                `Current team roles for reference:`,
                `- ⚡ Nora: Director of System Ops — orchestrates task pipelines, agent coordination`,
                `- 🕵️ Scout: Influencer Research Analyst — partnership research, creator discovery`,
                `- ❤️‍🔥 Solara: Brand Voice — narrative architecture, content strategy`,
                `- 🧬 Sage: Health Intelligence Researcher — exercise science, wellness trends`,
                ``,
                `Let's define ${displayName}'s soul. Start by discussing the GAP they fill.`,
            ].join('\n');

            await groupChatService.broadcastMessage(chatId, seedPrompt, participants);

            const agentMeta: AgentDraft = {
                name: displayName,
                id: agentId,
                emoji,
                device,
            };

            // Store the onboarding session in Firestore for tracking
            await addDoc(collection(db, 'agent-onboarding'), {
                agentId,
                displayName,
                emoji,
                device,
                chatId,
                status: 'brainstorming',
                createdAt: serverTimestamp(),
            });

            // Hand off to the parent to open the group chat modal
            onStartBrainstorm(chatId, participants, agentMeta);
        } catch (err: any) {
            console.error('Failed to start onboarding:', err);
            setError(err.message || 'Failed to create onboarding session');
            setStep('form');
        }
    }, [name, emoji, device, agentId, validate, onStartBrainstorm]);

    return ReactDOM.createPortal(
        <div className="add-agent-overlay" onClick={onClose}>
            <div className="add-agent-modal" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="add-agent-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="add-agent-icon">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="add-agent-title">Add New Agent</h2>
                            <p className="add-agent-subtitle">
                                {step === 'form'
                                    ? 'Name your agent and start a brainstorm to define their soul'
                                    : 'Setting up onboarding session...'}
                            </p>
                        </div>
                    </div>
                    <button className="add-agent-close" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {step === 'form' && (
                    <div className="add-agent-body">
                        {/* Name Input */}
                        <div className="add-agent-field">
                            <label className="add-agent-label">Agent Name</label>
                            <input
                                type="text"
                                className="add-agent-input"
                                placeholder="e.g. Phoenix, Atlas, Cipher..."
                                value={name}
                                onChange={(e) => { setName(e.target.value); setError(''); }}
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                            />
                            {agentId && (
                                <span className="add-agent-id-preview">
                                    ID: <code>{agentId}</code>
                                </span>
                            )}
                        </div>

                        {/* Emoji Picker */}
                        <div className="add-agent-field">
                            <label className="add-agent-label">Emoji</label>
                            <div className="add-agent-emoji-grid">
                                {EMOJI_OPTIONS.map((em) => (
                                    <button
                                        key={em}
                                        className={`add-agent-emoji-btn ${emoji === em ? 'selected' : ''}`}
                                        onClick={() => setEmoji(em)}
                                    >
                                        {em}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Device Selector */}
                        <div className="add-agent-field">
                            <label className="add-agent-label">Host Device</label>
                            <div className="add-agent-device-list">
                                {DEVICES.map((d) => (
                                    <button
                                        key={d.id}
                                        className={`add-agent-device ${device === d.id ? 'selected' : ''}`}
                                        onClick={() => setDevice(d.id)}
                                    >
                                        <span className="add-agent-device-icon">{d.icon}</span>
                                        <div>
                                            <div className="add-agent-device-name">{d.label}</div>
                                            <div className="add-agent-device-desc">{d.description}</div>
                                        </div>
                                        {device === d.id && <CheckCircle2 className="w-4 h-4" style={{ color: '#22c55e', flexShrink: 0 }} />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="add-agent-error">{error}</div>
                        )}

                        {/* Workflow Preview */}
                        <div className="add-agent-workflow">
                            <div className="add-agent-workflow-title">
                                <Sparkles className="w-3 h-3" /> What happens next
                            </div>
                            <div className="add-agent-workflow-steps">
                                <div className="add-agent-wf-step">
                                    <span className="add-agent-wf-num">1</span>
                                    <span>Round Table brainstorm opens — agents define the new soul</span>
                                </div>
                                <div className="add-agent-wf-step">
                                    <span className="add-agent-wf-num">2</span>
                                    <span>You guide the discussion and approve the final soul</span>
                                </div>
                                <div className="add-agent-wf-step">
                                    <span className="add-agent-wf-num">3</span>
                                    <span>Lock it in → Nora automates the rest (config, daemon, onboarding)</span>
                                </div>
                            </div>
                        </div>

                        {/* Submit */}
                        <button className="add-agent-submit" onClick={handleSubmit}>
                            <Sparkles className="w-4 h-4" />
                            Start Brainstorm
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {step === 'creating' && (
                    <div className="add-agent-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
                        <Loader2 className="w-8 h-8" style={{ margin: '0 auto 16px', animation: 'spin 1s linear infinite', color: '#a78bfa' }} />
                        <p style={{ color: '#e7e9ea', fontSize: 15, fontWeight: 500 }}>
                            Creating onboarding session for {emoji} {name}...
                        </p>
                        <p style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
                            Preparing the Round Table brainstorm
                        </p>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

/* ─── Lock-In Banner (shown inside GroupChatModal during onboarding) ── */

interface LockInBannerProps {
    agentDraft: AgentDraft;
    onLockIn: () => void;
    locking: boolean;
}

export const LockInBanner: React.FC<LockInBannerProps> = ({ agentDraft, onLockIn, locking }) => (
    <div className="lockin-banner">
        <div className="lockin-banner-left">
            <span className="lockin-emoji">{agentDraft.emoji}</span>
            <div>
                <div className="lockin-title">Onboarding: {agentDraft.name}</div>
                <div className="lockin-desc">
                    When the team has agreed on the soul, lock it in to start automated setup
                </div>
            </div>
        </div>
        <button
            className="lockin-btn"
            onClick={onLockIn}
            disabled={locking}
        >
            {locking ? (
                <>
                    <Loader2 className="w-4 h-4" style={{ animation: 'spin 1s linear infinite' }} />
                    Locking in...
                </>
            ) : (
                <>
                    <Lock className="w-4 h-4" />
                    Lock In Soul
                </>
            )}
        </button>
    </div>
);

export default AddAgentModal;
