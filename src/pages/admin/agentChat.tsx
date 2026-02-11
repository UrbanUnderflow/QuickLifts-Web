import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { presenceService, AgentPresence } from '../../api/firebase/presence/service';
import { db } from '../../api/firebase/config';
import {
    collection, addDoc, serverTimestamp, query, where, orderBy,
    onSnapshot, Timestamp, limit, doc, updateDoc
} from 'firebase/firestore';
import {
    ArrowLeft, Send, Zap, Brain, MessageSquare, ListTodo,
    HelpCircle, Terminal, ChevronDown, Loader2, CheckCircle2,
    Clock, Circle, AlertCircle
} from 'lucide-react';

/* ─── Types ───────────────────────────────────────────── */

interface ChatMessage {
    id: string;
    from: string;
    to: string;
    type: 'task' | 'command' | 'question' | 'chat' | 'email';
    content: string;
    response?: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    createdAt?: Date;
    completedAt?: Date;
    metadata?: Record<string, any>;
}

type MessageType = 'task' | 'command' | 'question' | 'chat';

const MESSAGE_TYPES: { type: MessageType; label: string; icon: React.ReactNode; desc: string }[] = [
    { type: 'task', label: 'Task', icon: <ListTodo className="w-4 h-4" />, desc: 'Assign work — agent decomposes & executes' },
    { type: 'command', label: 'Command', icon: <Terminal className="w-4 h-4" />, desc: 'Direct instruction — immediate action' },
    { type: 'question', label: 'Question', icon: <HelpCircle className="w-4 h-4" />, desc: 'Ask for info or status' },
    { type: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" />, desc: 'General conversation' },
];

/* ─── Helpers ─────────────────────────────────────────── */

const AGENT_EMOJIS: Record<string, string> = {
    nora: '⚡',
    antigravity: '🌌',
};

const AGENT_ROLES: Record<string, string> = {
    nora: 'Director of System Ops',
    antigravity: 'Co-CEO · Strategy & Architecture',
};

const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatRelative = (date?: Date) => {
    if (!date) return '';
    const diff = Date.now() - date.getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return date.toLocaleDateString();
};

const statusColor = (status: string) => {
    switch (status) {
        case 'working': return '#22c55e';
        case 'idle': return '#eab308';
        case 'offline': return '#ef4444';
        default: return '#71717a';
    }
};

/* ─── Agent List Screen ───────────────────────────────── */

const AgentListScreen: React.FC<{
    agents: AgentPresence[];
    onSelectAgent: (agent: AgentPresence) => void;
}> = ({ agents, onSelectAgent }) => {
    return (
        <div className="ac-agent-list">
            <div className="ac-list-header">
                <div>
                    <p className="ac-list-subtitle">Agent Comms</p>
                    <h1 className="ac-list-title">Messages</h1>
                </div>
                <div className="ac-header-badge">
                    <Zap className="w-4 h-4" />
                    <span>{agents.filter(a => a.status !== 'offline').length} online</span>
                </div>
            </div>

            <div className="ac-agents">
                {agents.map((agent) => (
                    <button
                        key={agent.id}
                        className="ac-agent-row"
                        onClick={() => onSelectAgent(agent)}
                    >
                        <div className="ac-agent-avatar">
                            <span className="ac-avatar-emoji">{agent.emoji || AGENT_EMOJIS[agent.id] || '🤖'}</span>
                            <div className="ac-status-dot" style={{ background: statusColor(agent.status) }} />
                        </div>
                        <div className="ac-agent-info">
                            <div className="ac-agent-name-row">
                                <span className="ac-agent-name">{agent.displayName}</span>
                                {agent.lastUpdate && (
                                    <span className="ac-agent-time">{formatRelative(agent.lastUpdate)}</span>
                                )}
                            </div>
                            <p className="ac-agent-role">{AGENT_ROLES[agent.id] || 'Agent'}</p>
                            <p className="ac-agent-preview">
                                {agent.status === 'working' && agent.currentTask
                                    ? `🔨 ${agent.currentTask}`
                                    : agent.notes || `${agent.status === 'idle' ? '💤 Waiting for tasks...' : '🔴 Offline'}`
                                }
                            </p>
                        </div>
                        <div className="ac-agent-chevron">›</div>
                    </button>
                ))}
            </div>
        </div>
    );
};

/* ─── Chat Screen ─────────────────────────────────────── */

const ChatScreen: React.FC<{
    agent: AgentPresence;
    onBack: () => void;
}> = ({ agent, onBack }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [msgType, setMsgType] = useState<MessageType>('task');
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Listen for messages involving this agent
    useEffect(() => {
        const commandsRef = collection(db, 'agent-commands');
        const q = query(
            commandsRef,
            where('to', '==', agent.id),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const msgs: ChatMessage[] = snapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    from: data.from || 'unknown',
                    to: data.to || '',
                    type: data.type || 'chat',
                    content: data.content || '',
                    response: data.response || '',
                    status: data.status || 'pending',
                    createdAt: data.createdAt?.toDate?.() || undefined,
                    completedAt: data.completedAt?.toDate?.() || undefined,
                    metadata: data.metadata || {},
                };
            }).reverse(); // oldest first
            setMessages(msgs);
        });

        return unsub;
    }, [agent.id]);

    // Auto-scroll on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputText(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    };

    // Send message
    const sendMessage = async () => {
        const text = inputText.trim();
        if (!text || sending) return;

        setSending(true);
        try {
            await addDoc(collection(db, 'agent-commands'), {
                from: 'admin',
                to: agent.id,
                type: msgType,
                content: text,
                metadata: {},
                status: 'pending',
                createdAt: serverTimestamp(),
            });

            setInputText('');
            if (inputRef.current) {
                inputRef.current.style.height = 'auto';
            }
        } catch (err) {
            console.error('Failed to send message:', err);
        }
        setSending(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const selectedType = MESSAGE_TYPES.find(t => t.type === msgType)!;

    return (
        <div className="ac-chat-screen">
            {/* Chat Header */}
            <div className="ac-chat-header">
                <button className="ac-back-btn" onClick={onBack}>
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="ac-chat-agent-info">
                    <div className="ac-chat-avatar">
                        <span>{agent.emoji || AGENT_EMOJIS[agent.id] || '🤖'}</span>
                        <div className="ac-status-dot-sm" style={{ background: statusColor(agent.status) }} />
                    </div>
                    <div>
                        <h2 className="ac-chat-name">{agent.displayName}</h2>
                        <p className="ac-chat-status">
                            {agent.status === 'working'
                                ? `Working: ${agent.currentTask || 'task'}`
                                : agent.status === 'idle' ? 'Online · Idle' : 'Offline'
                            }
                        </p>
                    </div>
                </div>
                {agent.status === 'working' && agent.taskProgress > 0 && (
                    <div className="ac-progress-badge">
                        <Zap className="w-3 h-3" />
                        <span>{agent.taskProgress}%</span>
                    </div>
                )}
            </div>

            {/* Messages Area */}
            <div className="ac-messages">
                {messages.length === 0 && (
                    <div className="ac-empty-chat">
                        <div className="ac-empty-icon">{agent.emoji || AGENT_EMOJIS[agent.id] || '🤖'}</div>
                        <h3>Start a conversation with {agent.displayName}</h3>
                        <p>Send a task, question, or command. Messages go directly to the agent runner pipeline — real work gets done.</p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg.id} className="ac-message-group">
                        {/* User message (outgoing) */}
                        <div className="ac-msg ac-msg-out">
                            <div className="ac-msg-meta-out">
                                <span className={`ac-msg-type-badge type-${msg.type}`}>
                                    {msg.type}
                                </span>
                                {msg.createdAt && (
                                    <span className="ac-msg-time">{formatTime(msg.createdAt)}</span>
                                )}
                            </div>
                            <div className="ac-msg-bubble ac-bubble-out">
                                <p>{msg.content}</p>
                            </div>
                        </div>

                        {/* Agent response (incoming) */}
                        {msg.response && (
                            <div className="ac-msg ac-msg-in">
                                <div className="ac-msg-avatar-sm">
                                    {agent.emoji || AGENT_EMOJIS[agent.id] || '🤖'}
                                </div>
                                <div className="ac-msg-in-content">
                                    <div className="ac-msg-bubble ac-bubble-in">
                                        <p>{msg.response}</p>
                                    </div>
                                    <div className="ac-msg-meta-in">
                                        <StatusIcon status={msg.status} />
                                        <span className="ac-msg-time">{msg.completedAt ? formatTime(msg.completedAt) : ''}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pending/in-progress indicator */}
                        {!msg.response && msg.status !== 'completed' && (
                            <div className="ac-msg ac-msg-in">
                                <div className="ac-msg-avatar-sm">
                                    {agent.emoji || AGENT_EMOJIS[agent.id] || '🤖'}
                                </div>
                                <div className="ac-msg-in-content">
                                    <div className="ac-msg-bubble ac-bubble-in ac-bubble-pending">
                                        {msg.status === 'in-progress' ? (
                                            <span className="ac-typing">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                Working on it...
                                            </span>
                                        ) : (
                                            <span className="ac-typing">
                                                <Clock className="w-3.5 h-3.5" />
                                                Queued
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Type Selector Dropdown */}
            {showTypeSelector && (
                <div className="ac-type-dropdown">
                    {MESSAGE_TYPES.map((t) => (
                        <button
                            key={t.type}
                            className={`ac-type-option ${msgType === t.type ? 'active' : ''}`}
                            onClick={() => { setMsgType(t.type); setShowTypeSelector(false); }}
                        >
                            <div className="ac-type-icon">{t.icon}</div>
                            <div>
                                <p className="ac-type-label">{t.label}</p>
                                <p className="ac-type-desc">{t.desc}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="ac-input-area">
                <button
                    className={`ac-type-btn type-${msgType}`}
                    onClick={() => setShowTypeSelector(!showTypeSelector)}
                >
                    {selectedType.icon}
                    <span>{selectedType.label}</span>
                    <ChevronDown className="w-3 h-3" />
                </button>

                <div className="ac-input-row">
                    <textarea
                        ref={inputRef}
                        className="ac-text-input"
                        placeholder={`Send a ${msgType} to ${agent.displayName}...`}
                        value={inputText}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                    <button
                        className="ac-send-btn"
                        onClick={sendMessage}
                        disabled={!inputText.trim() || sending}
                    >
                        {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── Status Icon ─────────────────────────────────────── */

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
    switch (status) {
        case 'completed':
            return <CheckCircle2 className="w-3 h-3 text-green-400" />;
        case 'in-progress':
            return <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />;
        case 'failed':
            return <AlertCircle className="w-3 h-3 text-red-400" />;
        default:
            return <Circle className="w-3 h-3 text-zinc-500" />;
    }
};

/* ─── Main Page Component ─────────────────────────────── */

const AgentChatContent: React.FC = () => {
    const router = useRouter();
    const [agents, setAgents] = useState<AgentPresence[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<AgentPresence | null>(null);

    // Listen for agent presence
    useEffect(() => {
        const unsub = presenceService.listen((incoming) => {
            // Add Antigravity as static agent if missing
            const hasAntigravity = incoming.some(a => a.id === 'antigravity');
            const all = hasAntigravity ? incoming : [{
                id: 'antigravity',
                displayName: 'Antigravity',
                emoji: '🌌',
                status: 'working' as const,
                currentTask: 'Pair programming with Tremaine',
                currentTaskId: '',
                notes: 'IDE Agent — always online',
                executionSteps: [],
                currentStepIndex: -1,
                taskProgress: 0,
                lastUpdate: new Date(),
                sessionStartedAt: new Date(),
            }, ...incoming];
            setAgents(all);

            // Update selected agent data if we're in a chat
            if (selectedAgent) {
                const updated = all.find(a => a.id === selectedAgent.id);
                if (updated) setSelectedAgent(updated);
            }
        });
        return unsub;
    }, [selectedAgent?.id]);

    // Handle agent from URL param
    useEffect(() => {
        const agentId = router.query.agent as string;
        if (agentId && agents.length > 0 && !selectedAgent) {
            const found = agents.find(a => a.id === agentId);
            if (found) setSelectedAgent(found);
        }
    }, [router.query.agent, agents, selectedAgent]);

    return (
        <div className="ac-root">
            <Head>
                <title>Agent Chat – Pulse Admin</title>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <meta name="theme-color" content="#09090b" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
                    rel="stylesheet"
                />
            </Head>
            <AdminRouteGuard>
                {selectedAgent ? (
                    <ChatScreen
                        agent={selectedAgent}
                        onBack={() => {
                            setSelectedAgent(null);
                            router.replace('/admin/agentChat', undefined, { shallow: true });
                        }}
                    />
                ) : (
                    <AgentListScreen agents={agents} onSelectAgent={(agent) => {
                        setSelectedAgent(agent);
                        router.replace(`/admin/agentChat?agent=${agent.id}`, undefined, { shallow: true });
                    }} />
                )}
            </AdminRouteGuard>

            <style jsx global>{`
        /* ─── Root & Reset ─────────────────────────────── */
        .ac-root {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #09090b;
          min-height: 100vh;
          min-height: 100dvh;
          color: #fafafa;
          overflow: hidden;
          position: relative;
        }

        /* ─── Agent List Screen ────────────────────────── */
        .ac-agent-list {
          display: flex;
          flex-direction: column;
          height: 100vh;
          height: 100dvh;
        }

        .ac-list-header {
          padding: 56px 20px 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          background: linear-gradient(180deg, #18181b 0%, #09090b 100%);
          border-bottom: 1px solid #27272a;
        }

        .ac-list-subtitle {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #71717a;
          margin: 0 0 2px;
          font-weight: 600;
        }

        .ac-list-title {
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .ac-header-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 20px;
          background: rgba(34, 197, 94, 0.12);
          color: #4ade80;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .ac-agents {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
          -webkit-overflow-scrolling: touch;
        }

        .ac-agent-row {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 14px 20px;
          border: none;
          background: transparent;
          color: inherit;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
          border-bottom: 1px solid #1a1a1e;
        }

        .ac-agent-row:hover {
          background: #18181b;
        }

        .ac-agent-row:active {
          background: #1f1f23;
        }

        .ac-agent-avatar {
          position: relative;
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(135deg, #27272a, #1a1a1e);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ac-avatar-emoji {
          font-size: 24px;
        }

        .ac-status-dot {
          position: absolute;
          bottom: -1px;
          right: -1px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2.5px solid #09090b;
        }

        .ac-agent-info {
          flex: 1;
          min-width: 0;
        }

        .ac-agent-name-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        .ac-agent-name {
          font-size: 16px;
          font-weight: 600;
          color: #fafafa;
        }

        .ac-agent-time {
          font-size: 12px;
          color: #52525b;
          flex-shrink: 0;
        }

        .ac-agent-role {
          font-size: 12px;
          color: #818cf8;
          margin: 1px 0 4px;
          font-weight: 500;
        }

        .ac-agent-preview {
          font-size: 13px;
          color: #71717a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
        }

        .ac-agent-chevron {
          font-size: 20px;
          color: #3f3f46;
          flex-shrink: 0;
        }

        /* ─── Chat Screen ──────────────────────────────── */
        .ac-chat-screen {
          display: flex;
          flex-direction: column;
          height: 100vh;
          height: 100dvh;
        }

        .ac-chat-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 52px 16px 12px;
          background: rgba(24, 24, 27, 0.95);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid #27272a;
          z-index: 10;
        }

        .ac-back-btn {
          background: none;
          border: none;
          color: #818cf8;
          cursor: pointer;
          padding: 6px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }

        .ac-back-btn:hover {
          background: rgba(129, 140, 248, 0.1);
        }

        .ac-chat-agent-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
        }

        .ac-chat-avatar {
          position: relative;
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: linear-gradient(135deg, #27272a, #1a1a1e);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }

        .ac-status-dot-sm {
          position: absolute;
          bottom: -1px;
          right: -1px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: 2px solid #18181b;
        }

        .ac-chat-name {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
          color: #fafafa;
        }

        .ac-chat-status {
          font-size: 11px;
          color: #71717a;
          margin: 1px 0 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }

        .ac-progress-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 12px;
          background: rgba(99, 102, 241, 0.15);
          color: #818cf8;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }

        /* ─── Messages ─────────────────────────────────── */
        .ac-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          -webkit-overflow-scrolling: touch;
        }

        .ac-empty-chat {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          flex: 1;
          padding: 40px 20px;
          gap: 8px;
        }

        .ac-empty-icon {
          font-size: 48px;
          margin-bottom: 8px;
        }

        .ac-empty-chat h3 {
          font-size: 16px;
          font-weight: 600;
          color: #d4d4d8;
          margin: 0;
        }

        .ac-empty-chat p {
          font-size: 13px;
          color: #71717a;
          max-width: 280px;
          line-height: 1.5;
          margin: 0;
        }

        .ac-message-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ac-msg {
          display: flex;
          gap: 8px;
          max-width: 85%;
        }

        .ac-msg-out {
          align-self: flex-end;
          flex-direction: column;
          align-items: flex-end;
        }

        .ac-msg-in {
          align-self: flex-start;
        }

        .ac-msg-meta-out {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 3px;
        }

        .ac-msg-type-badge {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 2px 8px;
          border-radius: 6px;
        }

        .ac-msg-type-badge.type-task {
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
        }

        .ac-msg-type-badge.type-command {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
        }

        .ac-msg-type-badge.type-question {
          background: rgba(234, 179, 8, 0.15);
          color: #fbbf24;
        }

        .ac-msg-type-badge.type-chat {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }

        .ac-msg-type-badge.type-email {
          background: rgba(244, 63, 94, 0.15);
          color: #fb7185;
        }

        .ac-msg-time {
          font-size: 10px;
          color: #52525b;
        }

        .ac-msg-bubble {
          padding: 10px 14px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.5;
          word-break: break-word;
        }

        .ac-msg-bubble p {
          margin: 0;
          white-space: pre-wrap;
        }

        .ac-bubble-out {
          background: linear-gradient(135deg, #4f46e5, #6366f1);
          color: #fff;
          border-bottom-right-radius: 6px;
        }

        .ac-bubble-in {
          background: #1e1e24;
          color: #d4d4d8;
          border-bottom-left-radius: 6px;
          border: 1px solid #2a2a30;
        }

        .ac-bubble-pending {
          padding: 10px 16px;
        }

        .ac-msg-avatar-sm {
          width: 28px;
          height: 28px;
          border-radius: 10px;
          background: #27272a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .ac-msg-in-content {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .ac-msg-meta-in {
          display: flex;
          align-items: center;
          gap: 4px;
          padding-left: 4px;
        }

        .ac-typing {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #71717a;
        }

        /* ─── Type Selector Dropdown ───────────────────── */
        .ac-type-dropdown {
          position: absolute;
          bottom: 88px;
          left: 16px;
          right: 16px;
          background: #1e1e24;
          border: 1px solid #2a2a30;
          border-radius: 16px;
          padding: 6px;
          z-index: 20;
          box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
          animation: slideUp 0.2s ease;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ac-type-option {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px;
          border: none;
          background: transparent;
          color: #d4d4d8;
          text-align: left;
          cursor: pointer;
          border-radius: 12px;
          transition: background 0.15s;
        }

        .ac-type-option:hover, .ac-type-option.active {
          background: rgba(99, 102, 241, 0.1);
        }

        .ac-type-option.active {
          color: #818cf8;
        }

        .ac-type-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #27272a;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ac-type-label {
          font-size: 14px;
          font-weight: 600;
          margin: 0;
        }

        .ac-type-desc {
          font-size: 11px;
          color: #71717a;
          margin: 2px 0 0;
        }

        /* ─── Input Area ───────────────────────────────── */
        .ac-input-area {
          padding: 8px 12px;
          padding-bottom: max(8px, env(safe-area-inset-bottom));
          background: rgba(24, 24, 27, 0.95);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-top: 1px solid #27272a;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ac-type-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          width: fit-content;
          transition: all 0.15s;
        }

        .ac-type-btn.type-task {
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
        }

        .ac-type-btn.type-command {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
        }

        .ac-type-btn.type-question {
          background: rgba(234, 179, 8, 0.15);
          color: #fbbf24;
        }

        .ac-type-btn.type-chat {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }

        .ac-input-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }

        .ac-text-input {
          flex: 1;
          border: 1px solid #2a2a30;
          background: #1a1a1e;
          color: #fafafa;
          padding: 10px 14px;
          border-radius: 20px;
          font-size: 15px;
          font-family: inherit;
          resize: none;
          outline: none;
          transition: border-color 0.2s;
          line-height: 1.4;
          max-height: 120px;
        }

        .ac-text-input::placeholder {
          color: #52525b;
        }

        .ac-text-input:focus {
          border-color: #4f46e5;
        }

        .ac-send-btn {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, #4f46e5, #6366f1);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .ac-send-btn:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
        }

        .ac-send-btn:disabled {
          opacity: 0.3;
          cursor: default;
        }

        /* ─── Desktop adjustments ──────────────────────── */
        @media (min-width: 640px) {
          .ac-root {
            max-width: 480px;
            margin: 0 auto;
            border-left: 1px solid #1a1a1e;
            border-right: 1px solid #1a1a1e;
          }
        }

        /* ─── Scrollbar ────────────────────────────────── */
        .ac-messages::-webkit-scrollbar,
        .ac-agents::-webkit-scrollbar {
          width: 4px;
        }

        .ac-messages::-webkit-scrollbar-thumb,
        .ac-agents::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 4px;
        }

        .ac-messages::-webkit-scrollbar-track,
        .ac-agents::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
        </div>
    );
};

/* ─── Export ───────────────────────────────────────────── */

export default function AgentChatPage() {
    return <AgentChatContent />;
}
