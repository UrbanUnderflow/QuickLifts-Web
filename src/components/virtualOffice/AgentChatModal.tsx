import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
    X, Send, ArrowLeft, Loader2, Zap, ChevronDown,
    AlertCircle, CheckCircle2, Circle, XCircle,
    MessageSquare, Terminal, HelpCircle, Mail, Sparkles,
    Paperclip, FileText, FolderOpen, Code2,
} from 'lucide-react';
import { presenceService, type AgentPresence } from '../../api/firebase/presence/service';
import { db } from '../../api/firebase/config';
import {
    collection, query, where, orderBy, limit,
    onSnapshot, addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { meetingMinutesService } from '../../api/firebase/meetingMinutes/service';
import type { MeetingMinutes } from '../../api/firebase/meetingMinutes/types';

/* ─── Types & Constants ───────────────────────────────── */

interface ChatMessage {
    id: string;
    from: string;
    to: string;
    type: 'auto' | 'task' | 'command' | 'question' | 'chat' | 'email';
    content: string;
    response?: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    createdAt?: Date;
    completedAt?: Date;
    metadata?: Record<string, any>;
}

type MessageType = ChatMessage['type'];

const MESSAGE_TYPES: { type: MessageType; label: string; icon: React.ReactNode; desc: string }[] = [
    { type: 'auto', label: 'Auto', icon: <Zap className="w-4 h-4" />, desc: 'AI detects intent' },
    { type: 'task', label: 'Task', icon: <Sparkles className="w-4 h-4" />, desc: 'Assign a work item' },
    { type: 'command', label: 'Command', icon: <Terminal className="w-4 h-4" />, desc: 'Run a command' },
    { type: 'question', label: 'Question', icon: <HelpCircle className="w-4 h-4" />, desc: 'Ask a question' },
    { type: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" />, desc: 'Free-form message' },
    { type: 'email', label: 'Email', icon: <Mail className="w-4 h-4" />, desc: 'Draft an email' },
];

const AGENT_EMOJIS: Record<string, string> = {
    nora: '⚡', antigravity: '🌌', scout: '🕵️', solara: '❤️‍🔥',
};

const AGENT_ROLES: Record<string, string> = {
    nora: 'Director of System Ops',
    antigravity: 'Co-CEO · Strategy & Architecture',
    scout: 'Influencer Research Analyst',
    solara: 'Brand Voice',
    sage: 'Health Intelligence Researcher',
};

const AGENT_HEARTBEAT_STALE_MS = 2 * 60_000;
const OFFLINE_RESPONSE_TIMEOUT_MS = 45_000;

/* ─── Props ───────────────────────────────────────────── */

interface AgentChatModalProps {
    agents: AgentPresence[];
    initialAgent?: AgentPresence | null;
    onClose: () => void;
}

/* ─── Helpers ─────────────────────────────────────────── */

const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatRelative = (date?: Date) => {
    if (!date) return '';
    const diff = Date.now() - date.getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return formatTime(date);
};

const isAgentStale = (agent?: AgentPresence | null) =>
    agent?.lastUpdate ? Date.now() - agent.lastUpdate.getTime() > AGENT_HEARTBEAT_STALE_MS : true;

const statusColor = (status: string) => {
    switch (status) {
        case 'working': return '#818cf8';
        case 'idle': return '#4ade80';
        default: return '#ef4444';
    }
};

/* ─── StatusIcon ──────────────────────────────────────── */

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
    switch (status) {
        case 'completed': return <CheckCircle2 className="w-3 h-3" style={{ color: '#4ade80' }} />;
        case 'in-progress': return <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#818cf8' }} />;
        case 'failed': return <XCircle className="w-3 h-3" style={{ color: '#ef4444' }} />;
        default: return <Circle className="w-3 h-3" style={{ color: '#52525b' }} />;
    }
};

/* ─── Main Component ──────────────────────────────────── */

export const AgentChatModal: React.FC<AgentChatModalProps> = ({
    agents,
    initialAgent = null,
    onClose,
}) => {
    const [selectedAgent, setSelectedAgent] = useState<AgentPresence | null>(initialAgent);

    // Keep selected agent data fresh from parent's presence updates
    useEffect(() => {
        if (selectedAgent) {
            const updated = agents.find(a => a.id === selectedAgent.id);
            if (updated) setSelectedAgent(updated);
        }
    }, [agents]);

    const modal = (
        <div className="dm-overlay" onClick={onClose}>
            <div className="dm-container" onClick={e => e.stopPropagation()}>
                {/* Agent List Sidebar */}
                <div className={`dm-sidebar ${selectedAgent ? 'dm-sidebar-hidden-mobile' : ''}`}>
                    <div className="dm-sidebar-header">
                        <div>
                            <p className="dm-sidebar-subtitle">Agent Comms</p>
                            <h2 className="dm-sidebar-title">Messages</h2>
                        </div>
                        <div className="dm-sidebar-badge">
                            <Zap className="w-3.5 h-3.5" />
                            <span>{agents.filter(a => a.status !== 'offline' && !isAgentStale(a)).length} online</span>
                        </div>
                    </div>
                    <div className="dm-agent-list">
                        {agents.filter(a => a.id !== 'antigravity').map(agent => {
                            const stale = isAgentStale(agent);
                            const displayStatus = stale ? 'offline' : agent.status;
                            const preview = displayStatus === 'working' && agent.currentTask
                                ? `🔨 ${agent.currentTask}`
                                : displayStatus === 'idle'
                                    ? (agent.notes || '💤 Waiting for tasks...')
                                    : '🔴 Offline';
                            return (
                                <button
                                    key={agent.id}
                                    className={`dm-agent-row ${selectedAgent?.id === agent.id ? 'dm-agent-active' : ''}`}
                                    onClick={() => setSelectedAgent(agent)}
                                >
                                    <div className="dm-agent-avatar">
                                        <span className="dm-avatar-emoji">{agent.emoji || AGENT_EMOJIS[agent.id] || '🤖'}</span>
                                        <div className="dm-status-dot" style={{ background: statusColor(displayStatus) }} />
                                    </div>
                                    <div className="dm-agent-info">
                                        <div className="dm-agent-name-row">
                                            <span className="dm-agent-name">{agent.displayName}</span>
                                            {agent.lastUpdate && <span className="dm-agent-time">{formatRelative(agent.lastUpdate)}</span>}
                                        </div>
                                        <p className="dm-agent-role">{agent.role || AGENT_ROLES[agent.id] || 'Agent'}</p>
                                        <p className="dm-agent-preview">{preview}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <button className="dm-close-btn-sidebar" onClick={onClose}>
                        <X className="w-4 h-4" /> Close
                    </button>
                </div>

                {/* Chat Panel */}
                {selectedAgent ? (
                    <ChatPanel
                        agent={selectedAgent}
                        onBack={() => setSelectedAgent(null)}
                        onClose={onClose}
                    />
                ) : (
                    <div className="dm-empty-panel">
                        <MessageSquare className="w-10 h-10" style={{ color: '#27272a' }} />
                        <p className="dm-empty-title">Select an agent</p>
                        <p className="dm-empty-desc">Choose an agent from the sidebar to start a conversation.</p>
                    </div>
                )}
            </div>

            <style jsx>{`
        /* ─── Overlay ────────────────────────────────── */
        .dm-overlay {
          position: fixed;
          inset: 0;
          z-index: 9997;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(6px);
          animation: dmFade 0.2s ease-out;
        }
        @keyframes dmFade { from { opacity:0; } to { opacity:1; } }

        /* ─── Container ──────────────────────────────── */
        .dm-container {
          width: 820px;
          max-width: 92vw;
          height: 75vh;
          max-height: 680px;
          border-radius: 20px;
          overflow: hidden;
          display: flex;
          background: #0d0d12;
          border: 1px solid rgba(63,63,70,0.2);
          box-shadow: 0 25px 80px rgba(0,0,0,0.6);
          animation: dmSlideUp 0.3s ease-out;
        }
        @keyframes dmSlideUp {
          from { opacity:0; transform: translateY(16px) scale(0.97); }
          to { opacity:1; transform: translateY(0) scale(1); }
        }

        /* ─── Sidebar ────────────────────────────────── */
        .dm-sidebar {
          width: 260px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: #111116;
          border-right: 1px solid rgba(63,63,70,0.15);
        }
        .dm-sidebar-header {
          padding: 18px 16px 14px;
          border-bottom: 1px solid rgba(63,63,70,0.12);
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .dm-sidebar-subtitle {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #52525b;
          margin: 0 0 1px;
          font-weight: 600;
        }
        .dm-sidebar-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
          color: #e4e4e7;
        }
        .dm-sidebar-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 12px;
          background: rgba(34,197,94,0.1);
          color: #4ade80;
          font-size: 10px;
          font-weight: 600;
          margin-bottom: 2px;
        }

        .dm-agent-list {
          flex: 1;
          overflow-y: auto;
        }
        .dm-agent-list::-webkit-scrollbar { width: 3px; }
        .dm-agent-list::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }

        .dm-agent-row {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          border: none;
          background: transparent;
          color: inherit;
          cursor: pointer;
          text-align: left;
          transition: background 0.12s;
          border-bottom: 1px solid rgba(63,63,70,0.08);
        }
        .dm-agent-row:hover { background: rgba(255,255,255,0.03); }
        .dm-agent-active { background: rgba(99,102,241,0.08); border-left: 2px solid #6366f1; }

        .dm-agent-avatar {
          position: relative;
          width: 36px; height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #1e1e24, #18181b);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .dm-avatar-emoji { font-size: 16px; }
        .dm-status-dot {
          position: absolute;
          bottom: -1px; right: -1px;
          width: 10px; height: 10px;
          border-radius: 50%;
          border: 2px solid #111116;
        }
        .dm-agent-info { flex: 1; min-width: 0; }
        .dm-agent-name-row { display: flex; justify-content: space-between; align-items: baseline; }
        .dm-agent-name { font-size: 12.5px; font-weight: 600; color: #e4e4e7; }
        .dm-agent-time { font-size: 10px; color: #3f3f46; }
        .dm-agent-role { font-size: 10px; color: #818cf8; margin: 1px 0 2px; font-weight: 500; }
        .dm-agent-preview {
          font-size: 11px; color: #52525b;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin: 0;
        }

        .dm-close-btn-sidebar {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          border: none;
          border-top: 1px solid rgba(63,63,70,0.12);
          background: transparent;
          color: #52525b;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.12s;
        }
        .dm-close-btn-sidebar:hover { background: rgba(255,255,255,0.03); color: #a1a1aa; }

        /* ─── Empty Panel ────────────────────────────── */
        .dm-empty-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .dm-empty-title { font-size: 14px; font-weight: 600; color: #3f3f46; margin: 0; }
        .dm-empty-desc { font-size: 12px; color: #27272a; margin: 0; }

        /* ─── Mobile: Full Screen ────────────────────── */
        @media (max-width: 767px) {
          .dm-container {
            width: 100vw;
            height: 100vh;
            height: 100dvh;
            max-width: 100vw;
            max-height: 100vh;
            border-radius: 0;
            flex-direction: column;
          }
          .dm-sidebar {
            width: 100%;
            height: 100%;
          }
          .dm-sidebar-hidden-mobile {
            display: none;
          }
          .dm-empty-panel { display: none; }
        }
      `}</style>
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
};


/* ─── Chat Panel (right side) ─────────────────────────── */

const ChatPanel: React.FC<{
    agent: AgentPresence;
    onBack: () => void;
    onClose: () => void;
}> = ({ agent, onBack, onClose }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [msgType, setMsgType] = useState<MessageType>('auto');
    const [showTypeSelector, setShowTypeSelector] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const autoFailedMessageIdsRef = useRef<Set<string>>(new Set());
    const [hasNewMessages, setHasNewMessages] = useState(false);

    // Meeting minutes attachment state
    const [showMinutesPicker, setShowMinutesPicker] = useState(false);
    const [allMinutes, setAllMinutes] = useState<MeetingMinutes[]>([]);
    const [attachedMinutes, setAttachedMinutes] = useState<MeetingMinutes | null>(null);
    const [loadingMinutes, setLoadingMinutes] = useState(false);
    const minutesPickerRef = useRef<HTMLDivElement>(null);

    // File browser state
    const [showFileBrowser, setShowFileBrowser] = useState(false);
    const [fileBrowserPath, setFileBrowserPath] = useState('/');
    const [fileBrowserItems, setFileBrowserItems] = useState<any[]>([]);
    const [fileBrowserLoading, setFileBrowserLoading] = useState(false);
    const [attachedFile, setAttachedFile] = useState<{ name: string; path: string; content: string; size: number } | null>(null);
    const [fileFilter, setFileFilter] = useState('');
    const [fileBrowserMode, setFileBrowserMode] = useState<'search' | 'browse'>('search');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const agentIsStale = isAgentStale(agent);
    const agentIsOnline = agent.status !== 'offline' && !agentIsStale;

    // Listen for messages involving this agent (BOTH directions)
    useEffect(() => {
        const commandsRef = collection(db, 'agent-commands');
        const qTo = query(commandsRef, where('to', '==', agent.id), orderBy('createdAt', 'desc'), limit(50));
        const qFrom = query(commandsRef, where('from', '==', agent.id), orderBy('createdAt', 'desc'), limit(50));

        let toMsgs: ChatMessage[] = [];
        let fromMsgs: ChatMessage[] = [];

        const mergeAndSet = () => {
            const map = new Map<string, ChatMessage>();
            [...toMsgs, ...fromMsgs].forEach(m => map.set(m.id, m));
            setMessages(Array.from(map.values()).sort(
                (a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0)
            ));
        };

        const mapDoc = (docSnap: any): ChatMessage => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
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
        };

        const unsub1 = onSnapshot(qTo,
            snap => { setError(null); toMsgs = snap.docs.map(mapDoc); mergeAndSet(); },
            err => {
                console.error('Firestore listener error (to):', err);
                setError(err.message?.includes('index') ? 'Missing Firestore index.' : `Firestore error: ${err.message}`);
            }
        );
        const unsub2 = onSnapshot(qFrom,
            snap => { fromMsgs = snap.docs.map(mapDoc); mergeAndSet(); },
            err => console.error('Firestore listener error (from):', err)
        );

        return () => { unsub1(); unsub2(); };
    }, [agent.id]);

    // Smart scroll — only auto-scroll if user is near the bottom
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distanceFromBottom < 120) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        } else {
            setHasNewMessages(true);
        }
    }, [messages]);

    // Clear new-message indicator when user scrolls to bottom
    const handleMessagesScroll = () => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distanceFromBottom < 80) setHasNewMessages(false);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        setHasNewMessages(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setInputText(val);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';

        // Detect `/b ` trigger for file search
        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursorPos);
        const slashBMatch = textBeforeCursor.match(/(^|\s)\/b\s(.*)$/i);

        if (slashBMatch) {
            const searchQuery = slashBMatch[2];
            setFileFilter(searchQuery);
            if (!showFileBrowser) {
                setShowFileBrowser(true);
                setFileBrowserMode('search');
            }
            // Debounce the search
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
            if (searchQuery.trim().length > 0) {
                searchDebounceRef.current = setTimeout(() => searchFiles(searchQuery.trim()), 200);
            } else {
                setSearchResults([]);
            }
            return;
        }

        // Detect solo `/` trigger for directory browser (fallback)
        const lastSlashIdx = textBeforeCursor.lastIndexOf('/');
        if (lastSlashIdx >= 0) {
            const charBefore = lastSlashIdx > 0 ? textBeforeCursor[lastSlashIdx - 1] : ' ';
            if (lastSlashIdx === 0 || /\s/.test(charBefore)) {
                const afterSlash = textBeforeCursor.slice(lastSlashIdx + 1);
                // Don't trigger browse if it's /b (that's search)
                if (afterSlash.startsWith('b')) return;
                setFileFilter(afterSlash);
                if (!showFileBrowser) {
                    setShowFileBrowser(true);
                    setFileBrowserMode('browse');
                    browseDirectory('/');
                }
                return;
            }
        }
        if (showFileBrowser) setShowFileBrowser(false);
    };

    const searchFiles = async (searchQuery: string) => {
        setFileBrowserLoading(true);
        try {
            const res = await fetch(`/api/files/browse?search=${encodeURIComponent(searchQuery)}`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data.results || []);
            }
        } catch (e) {
            console.error('Failed to search files:', e);
        }
        setFileBrowserLoading(false);
    };

    const browseDirectory = async (dirPath: string) => {
        setFileBrowserLoading(true);
        setFileBrowserPath(dirPath);
        try {
            const res = await fetch(`/api/files/browse?path=${encodeURIComponent(dirPath)}`);
            if (res.ok) {
                const data = await res.json();
                setFileBrowserItems(data.items || []);
            }
        } catch (e) {
            console.error('Failed to browse files:', e);
        }
        setFileBrowserLoading(false);
    };

    const selectFile = async (filePath: string) => {
        try {
            const res = await fetch(`/api/files/browse?path=${encodeURIComponent(filePath)}&read=true`);
            if (res.ok) {
                const data = await res.json();
                setAttachedFile({ name: data.name, path: data.path, content: data.content, size: data.size });
            } else {
                const errData = await res.json();
                setError(errData.error || 'Failed to read file');
                setTimeout(() => setError(null), 4000);
            }
        } catch (e) {
            console.error('Failed to read file:', e);
        }
        setShowFileBrowser(false);
        // Remove the `/b ...` or `/...` text from input
        const slashBIdx = inputText.search(/(^|\s)\/b\s/i);
        if (slashBIdx >= 0) {
            const actualSlash = inputText.indexOf('/b', slashBIdx);
            setInputText(inputText.slice(0, actualSlash).trimEnd());
        } else {
            const slashIdx = inputText.lastIndexOf('/');
            if (slashIdx >= 0) setInputText(inputText.slice(0, slashIdx));
        }
    };

    const sendMessage = async () => {
        const text = inputText.trim();
        if (!text || sending) return;
        setSending(true);

        const optimisticId = `optimistic-${Date.now()}`;
        const optimisticMsg: ChatMessage = {
            id: optimisticId, from: 'admin', to: agent.id, type: msgType,
            content: text, status: 'pending', createdAt: new Date(),
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setInputText('');
        if (inputRef.current) inputRef.current.style.height = 'auto';

        try {
            const contextParts: string[] = [text];
            if (attachedFile) {
                contextParts.push(`\n\n--- ATTACHED FILE: ${attachedFile.path} ---\n\`\`\`\n${attachedFile.content}\n\`\`\`\n--- END FILE ---`);
            }
            if (attachedMinutes) {
                const md = meetingMinutesService.toMarkdown(attachedMinutes);
                contextParts.push(`\n\n--- ATTACHED MEETING MINUTES ---\n${md}\n--- END MEETING MINUTES ---`);
            }

            await addDoc(collection(db, 'agent-commands'), {
                from: 'admin', to: agent.id, type: msgType,
                content: contextParts.join(''), metadata: {}, status: 'pending', createdAt: serverTimestamp(),
            });
            setAttachedMinutes(null);
            setAttachedFile(null);
        } catch (err: any) {
            console.error('Failed to send:', err);
            setError(`Send failed: ${err.message}`);
            setMessages(prev => prev.filter(m => m.id !== optimisticId));
            setTimeout(() => setError(null), 5000);
        }
        setSending(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    };

    // Auto-fail stale pending messages when agent offline
    useEffect(() => {
        if (agentIsOnline) return;
        const interval = setInterval(() => {
            const now = Date.now();
            messages.filter(msg => {
                if (msg.from !== 'admin' || msg.to !== agent.id || msg.response) return false;
                if (msg.status !== 'pending' && msg.status !== 'in-progress') return false;
                if (msg.id.startsWith('optimistic-')) return false;
                if (autoFailedMessageIdsRef.current.has(msg.id)) return false;
                if (!msg.createdAt) return false;
                return now - msg.createdAt.getTime() >= OFFLINE_RESPONSE_TIMEOUT_MS;
            }).forEach(async msg => {
                autoFailedMessageIdsRef.current.add(msg.id);
                try {
                    await updateDoc(doc(db, 'agent-commands', msg.id), {
                        status: 'failed',
                        response: `${agent.displayName} is currently offline. Please restart the agent runner and resend.`,
                        completedAt: serverTimestamp(),
                    });
                } catch (e) { console.error('Auto-fail error:', e); }
            });
        }, 5000);
        return () => clearInterval(interval);
    }, [agent.id, agent.displayName, agentIsOnline, messages]);

    const selectedType = MESSAGE_TYPES.find(t => t.type === msgType)!;

    return (
        <div className="dm-chat">
            {/* Header */}
            <div className="dm-chat-header">
                <button className="dm-back-btn" onClick={onBack}>
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="dm-chat-agent">
                    <div className="dm-chat-avatar">
                        <span>{agent.emoji || AGENT_EMOJIS[agent.id] || '🤖'}</span>
                        <div className="dm-chat-dot" style={{ background: statusColor(agentIsOnline ? agent.status : 'offline') }} />
                    </div>
                    <div>
                        <h3 className="dm-chat-name">{agent.displayName}</h3>
                        <p className="dm-chat-status">
                            {!agentIsOnline ? 'Offline'
                                : agent.status === 'working' ? `Working: ${agent.currentTask || 'task'}`
                                    : 'Online · Idle'}
                        </p>
                    </div>
                </div>
                <button className="dm-close-x" onClick={onClose}><X className="w-4 h-4" /></button>
            </div>

            {/* Banners */}
            {error && (
                <div className="dm-banner dm-banner-error">
                    <AlertCircle className="w-3.5 h-3.5" /><span>{error}</span>
                    <button onClick={() => setError(null)} className="dm-banner-close">✕</button>
                </div>
            )}
            {!agentIsOnline && (
                <div className="dm-banner dm-banner-offline">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{agent.displayName} is offline. Pending messages auto-fail after 45s.</span>
                </div>
            )}

            {/* Messages */}
            <div className="dm-messages" ref={messagesContainerRef} onScroll={handleMessagesScroll}>
                {messages.length === 0 && (
                    <div className="dm-empty-chat">
                        <div className="dm-empty-emoji">{agent.emoji || AGENT_EMOJIS[agent.id] || '🤖'}</div>
                        <h3>Chat with {agent.displayName}</h3>
                        <p>Send a task, question, or command.</p>
                    </div>
                )}
                {messages.map(msg => {
                    const isProactive = msg.from === agent.id;
                    return (
                        <div key={msg.id} className="dm-msg-group">
                            {isProactive ? (
                                <div className="dm-msg dm-msg-in">
                                    <div className="dm-msg-avi">{agent.emoji || AGENT_EMOJIS[agent.id] || '🤖'}</div>
                                    <div className="dm-msg-in-wrap">
                                        <div className="dm-bubble dm-bubble-in dm-bubble-proactive"><p>{msg.content}</p></div>
                                        <div className="dm-msg-meta-in">
                                            <span className="dm-type-tag type-proactive">{msg.metadata?.proactiveType || 'update'}</span>
                                            <span className="dm-msg-time">{msg.createdAt ? formatTime(msg.createdAt) : ''}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="dm-msg dm-msg-out">
                                        <div className="dm-msg-meta-out">
                                            <span className={`dm-type-tag type-${msg.type}`}>{msg.type}</span>
                                            {msg.createdAt && <span className="dm-msg-time">{formatTime(msg.createdAt)}</span>}
                                        </div>
                                        <div className="dm-bubble dm-bubble-out"><p>{msg.content}</p></div>
                                    </div>
                                    {msg.response && (
                                        <div className="dm-msg dm-msg-in">
                                            <div className="dm-msg-avi">{agent.emoji || AGENT_EMOJIS[agent.id] || '🤖'}</div>
                                            <div className="dm-msg-in-wrap">
                                                <div className="dm-bubble dm-bubble-in"><p>{msg.response}</p></div>
                                                <div className="dm-msg-meta-in">
                                                    <StatusIcon status={msg.status} />
                                                    <span className="dm-msg-time">{msg.completedAt ? formatTime(msg.completedAt) : ''}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {!msg.response && msg.status !== 'completed' && (
                                        <div className="dm-msg dm-msg-in">
                                            <div className="dm-msg-avi">{agent.emoji || AGENT_EMOJIS[agent.id] || '🤖'}</div>
                                            <div className="dm-msg-in-wrap">
                                                <div className="dm-bubble dm-bubble-in dm-bubble-pending">
                                                    <span className="dm-typing">
                                                        <Loader2 className="w-3 h-3 animate-spin" /> Thinking
                                                        <span className="dm-dots" aria-hidden>
                                                            <span>.</span><span>.</span><span>.</span>
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* New messages indicator */}
            {hasNewMessages && (
                <button className="dm-new-msg-btn" onClick={scrollToBottom}>
                    <ChevronDown className="w-4 h-4" />
                    <span>New messages</span>
                </button>
            )}

            {/* Type Selector */}
            {showTypeSelector && (
                <div className="dm-type-dropdown">
                    {MESSAGE_TYPES.map(t => (
                        <button
                            key={t.type}
                            className={`dm-type-option ${msgType === t.type ? 'active' : ''}`}
                            onClick={() => { setMsgType(t.type); setShowTypeSelector(false); }}
                        >
                            <div className="dm-type-icon">{t.icon}</div>
                            <div>
                                <p className="dm-type-label">{t.label}</p>
                                <p className="dm-type-desc">{t.desc}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="dm-input-area">
                <button
                    className={`dm-type-btn type-${msgType}`}
                    onClick={() => setShowTypeSelector(!showTypeSelector)}
                >
                    {selectedType.icon} <span>{selectedType.label}</span> <ChevronDown className="w-3 h-3" />
                </button>

                {/* Attached minutes chip */}
                {attachedMinutes && (
                    <div className="dm-attached-chip">
                        <FileText className="w-3 h-3" />
                        <span>{attachedMinutes.executiveSummary?.slice(0, 50) || 'Meeting Minutes'}...</span>
                        <button className="dm-chip-remove" onClick={() => setAttachedMinutes(null)}>✕</button>
                    </div>
                )}

                {/* Attached file chip */}
                {attachedFile && (
                    <div className="dm-attached-chip dm-file-chip">
                        <Code2 className="w-3 h-3" />
                        <span>{attachedFile.path}</span>
                        <span className="dm-file-size">{(attachedFile.size / 1024).toFixed(1)}KB</span>
                        <button className="dm-chip-remove" onClick={() => setAttachedFile(null)}>✕</button>
                    </div>
                )}

                {/* Minutes picker dropdown */}
                {showMinutesPicker && (
                    <div className="dm-minutes-picker" ref={minutesPickerRef}>
                        <div className="dm-minutes-picker-header">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Attach Meeting Minutes</span>
                        </div>
                        {loadingMinutes ? (
                            <div className="dm-minutes-loading">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Loading minutes...</span>
                            </div>
                        ) : allMinutes.length === 0 ? (
                            <div className="dm-minutes-empty">No saved meeting minutes yet</div>
                        ) : (
                            <div className="dm-minutes-list">
                                {allMinutes.map(m => {
                                    const date = m.createdAt instanceof Date
                                        ? m.createdAt
                                        : (m.createdAt as any)?.toDate?.() || new Date();
                                    return (
                                        <button
                                            key={m.id}
                                            className="dm-minutes-item"
                                            onClick={() => {
                                                setAttachedMinutes(m);
                                                setShowMinutesPicker(false);
                                            }}
                                        >
                                            <div className="dm-minutes-item-top">
                                                <span className="dm-minutes-date">
                                                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </span>
                                                <span className="dm-minutes-duration">{m.duration}</span>
                                            </div>
                                            <p className="dm-minutes-summary">
                                                {m.executiveSummary?.slice(0, 80) || 'Meeting minutes'}...
                                            </p>
                                            <div className="dm-minutes-agents">
                                                {m.participants.map(p => (
                                                    <span key={p} className="dm-minutes-agent-tag">{p}</span>
                                                ))}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* File browser dropdown */}
                {showFileBrowser && (
                    <div className="dm-file-browser">
                        <div className="dm-fb-header">
                            {fileBrowserMode === 'search' ? (
                                <>
                                    <Code2 className="w-3.5 h-3.5" style={{ color: '#818cf8' }} />
                                    <span className="dm-fb-path">Search: {fileFilter || '...'}</span>
                                </>
                            ) : (
                                <>
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    <span className="dm-fb-path">{fileBrowserPath}</span>
                                    {fileBrowserPath !== '/' && (
                                        <button className="dm-fb-up" onClick={() => {
                                            const parent = fileBrowserPath.split('/').slice(0, -1).join('/') || '/';
                                            browseDirectory(parent);
                                        }}>↑ Up</button>
                                    )}
                                </>
                            )}
                            <button className="dm-fb-close" onClick={() => setShowFileBrowser(false)}>✕</button>
                        </div>
                        {fileBrowserLoading ? (
                            <div className="dm-fb-loading"><Loader2 className="w-4 h-4 animate-spin" /><span>Searching...</span></div>
                        ) : fileBrowserMode === 'search' ? (
                            <div className="dm-fb-list">
                                {searchResults.length === 0 && fileFilter.trim() ? (
                                    <div className="dm-fb-empty">{fileFilter.trim().length < 2 ? 'Type to search files...' : 'No matching files'}</div>
                                ) : searchResults.length === 0 ? (
                                    <div className="dm-fb-empty">Type a filename to search...</div>
                                ) : (
                                    searchResults.map((item: any) => (
                                        <button
                                            key={item.path}
                                            className="dm-fb-item"
                                            onClick={() => {
                                                if (item.isDirectory) {
                                                    setFileBrowserMode('browse');
                                                    browseDirectory(item.path);
                                                } else {
                                                    selectFile(item.path);
                                                }
                                            }}
                                        >
                                            <span className="dm-fb-icon">{item.icon}</span>
                                            <div className="dm-fb-info">
                                                <span className="dm-fb-name">{item.name}</span>
                                                <span className="dm-fb-parent">{item.parentDir}</span>
                                            </div>
                                            {!item.isDirectory && item.size != null && (
                                                <span className="dm-fb-size">{(item.size / 1024).toFixed(1)}KB</span>
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div className="dm-fb-list">
                                {fileBrowserItems
                                    .filter(item => !fileFilter || item.name.toLowerCase().includes(fileFilter.toLowerCase()))
                                    .map(item => (
                                        <button
                                            key={item.path}
                                            className="dm-fb-item"
                                            onClick={() => {
                                                if (item.isDirectory) {
                                                    browseDirectory(item.path);
                                                    setFileFilter('');
                                                } else {
                                                    selectFile(item.path);
                                                }
                                            }}
                                        >
                                            <span className="dm-fb-icon">{item.icon}</span>
                                            <span className="dm-fb-name">{item.name}</span>
                                            {item.isDirectory && <span className="dm-fb-count">{item.children} items</span>}
                                            {!item.isDirectory && item.size != null && (
                                                <span className="dm-fb-size">{(item.size / 1024).toFixed(1)}KB</span>
                                            )}
                                        </button>
                                    ))}
                                {fileBrowserItems.filter(item => !fileFilter || item.name.toLowerCase().includes(fileFilter.toLowerCase())).length === 0 && (
                                    <div className="dm-fb-empty">No matching files</div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="dm-input-row">
                    <button
                        className="dm-attach-btn"
                        title="Attach meeting minutes"
                        onClick={async () => {
                            if (showMinutesPicker) {
                                setShowMinutesPicker(false);
                                return;
                            }
                            setShowMinutesPicker(true);
                            if (allMinutes.length === 0) {
                                setLoadingMinutes(true);
                                try {
                                    const mins = await meetingMinutesService.getAll();
                                    setAllMinutes(mins);
                                } catch (e) {
                                    console.error('Failed to load minutes:', e);
                                }
                                setLoadingMinutes(false);
                            }
                        }}
                    >
                        <Paperclip className="w-4 h-4" />
                    </button>
                    <textarea
                        ref={inputRef}
                        className="dm-text-input"
                        placeholder={`Message ${agent.displayName}...`}
                        value={inputText}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                    <button className="dm-send-btn" onClick={sendMessage} disabled={!inputText.trim() || sending}>
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <style jsx>{`
        /* ─── Chat Panel ─────────────────────────────── */
        .dm-chat {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          position: relative;
          background: #0d0d12;
        }

        .dm-chat-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(63,63,70,0.15);
          background: rgba(17,17,22,0.95);
        }
        .dm-back-btn {
          display: none;
          background: none; border: none;
          color: #818cf8; cursor: pointer;
          padding: 4px; border-radius: 6px;
        }
        .dm-back-btn:hover { background: rgba(99,102,241,0.1); }

        .dm-chat-agent { display: flex; align-items: center; gap: 10px; flex: 1; }
        .dm-chat-avatar {
          position: relative;
          width: 34px; height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, #1e1e24, #18181b);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
        }
        .dm-chat-dot {
          position: absolute; bottom: -1px; right: -1px;
          width: 9px; height: 9px; border-radius: 50%;
          border: 2px solid #111116;
        }
        .dm-chat-name { font-size: 14px; font-weight: 600; margin: 0; color: #e4e4e7; }
        .dm-chat-status { font-size: 10px; color: #52525b; margin: 1px 0 0; }

        .dm-close-x {
          background: none; border: none;
          color: #52525b; cursor: pointer;
          padding: 6px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
        }
        .dm-close-x:hover { background: rgba(255,255,255,0.06); color: #a1a1aa; }

        /* ─── Banners ────────────────────────────────── */
        .dm-banner {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px; font-size: 11px;
        }
        .dm-banner-error {
          background: rgba(239,68,68,0.1);
          border-bottom: 1px solid rgba(239,68,68,0.15);
          color: #fca5a5;
        }
        .dm-banner-offline {
          background: rgba(245,158,11,0.08);
          border-bottom: 1px solid rgba(245,158,11,0.12);
          color: #fbbf24;
        }
        .dm-banner-close {
          margin-left: auto; background: none; border: none;
          color: inherit; cursor: pointer; padding: 2px 4px; border-radius: 4px;
        }

        /* ─── Messages ───────────────────────────────── */
        .dm-messages {
          flex: 1; overflow-y: auto;
          padding: 14px; display: flex;
          flex-direction: column; gap: 12px;
        }
        .dm-messages::-webkit-scrollbar { width: 3px; }
        .dm-messages::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }

        .dm-empty-chat {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          flex: 1; text-align: center; gap: 6px; padding: 40px 20px;
        }
        .dm-empty-emoji { font-size: 36px; margin-bottom: 4px; }
        .dm-empty-chat h3 { font-size: 14px; font-weight: 600; color: #3f3f46; margin: 0; }
        .dm-empty-chat p { font-size: 12px; color: #27272a; margin: 0; }

        .dm-msg-group { display: flex; flex-direction: column; gap: 4px; }
        .dm-msg { display: flex; gap: 6px; max-width: 85%; }
        .dm-msg-out { align-self: flex-end; flex-direction: column; align-items: flex-end; }
        .dm-msg-in { align-self: flex-start; }

        .dm-msg-meta-out { display: flex; align-items: center; gap: 5px; margin-bottom: 2px; }
        .dm-msg-meta-in { display: flex; align-items: center; gap: 4px; padding-left: 3px; }

        .dm-type-tag {
          font-size: 9px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em;
          padding: 2px 6px; border-radius: 5px;
        }
        .dm-type-tag.type-auto { background: linear-gradient(135deg, rgba(251,146,60,0.15), rgba(168,85,247,0.15)); color: #fb923c; }
        .dm-type-tag.type-task { background: rgba(168,85,247,0.15); color: #c084fc; }
        .dm-type-tag.type-command { background: rgba(59,130,246,0.15); color: #60a5fa; }
        .dm-type-tag.type-question { background: rgba(234,179,8,0.15); color: #fbbf24; }
        .dm-type-tag.type-chat { background: rgba(34,197,94,0.15); color: #4ade80; }
        .dm-type-tag.type-email { background: rgba(244,63,94,0.15); color: #fb7185; }
        .dm-type-tag.type-proactive { background: rgba(20,184,166,0.15); color: #2dd4bf; }

        .dm-msg-time { font-size: 9px; color: #3f3f46; }

        .dm-bubble { padding: 9px 13px; border-radius: 16px; font-size: 13px; line-height: 1.5; word-break: break-word; }
        .dm-bubble p { margin: 0; white-space: pre-wrap; }
        .dm-bubble-out { background: linear-gradient(135deg, #4f46e5, #6366f1); color: #fff; border-bottom-right-radius: 5px; }
        .dm-bubble-in { background: #1a1a20; color: #d4d4d8; border-bottom-left-radius: 5px; border: 1px solid #222228; }
        .dm-bubble-pending { padding: 9px 14px; }
        .dm-bubble-proactive { border-left: 3px solid #14b8a6; }

        .dm-msg-avi {
          width: 24px; height: 24px; border-radius: 8px;
          background: #1e1e24; display: flex; align-items: center;
          justify-content: center; font-size: 12px; flex-shrink: 0; margin-top: 1px;
        }
        .dm-msg-in-wrap { display: flex; flex-direction: column; gap: 2px; }

        .dm-typing { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #52525b; }
        .dm-dots { display: inline-flex; width: 14px; }
        .dm-dots span { opacity: 0; animation: dmDot 1.2s infinite; display: inline-block; width: 4px; }
        .dm-dots span:nth-child(2) { animation-delay: 0.2s; }
        .dm-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dmDot { 0%,20% { opacity:0; } 40%,80% { opacity:1; } 100% { opacity:0; } }

        /* ─── Type Dropdown ──────────────────────────── */
        .dm-type-dropdown {
          position: absolute; bottom: 80px; left: 12px; right: 12px;
          background: #1a1a20; border: 1px solid #222228;
          border-radius: 14px; padding: 4px; z-index: 20;
          box-shadow: 0 -6px 24px rgba(0,0,0,0.5);
          animation: dmSlideUp2 0.15s ease-out;
        }
        @keyframes dmSlideUp2 { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }

        .dm-type-option {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 10px; border: none;
          background: transparent; color: #d4d4d8;
          text-align: left; cursor: pointer; border-radius: 10px;
          transition: background 0.12s;
        }
        .dm-type-option:hover, .dm-type-option.active { background: rgba(99,102,241,0.08); }
        .dm-type-option.active { color: #818cf8; }
        .dm-type-icon {
          width: 30px; height: 30px; border-radius: 8px;
          background: #27272a; display: flex; align-items: center;
          justify-content: center; flex-shrink: 0;
        }
        .dm-type-label { font-size: 12px; font-weight: 600; margin: 0; }
        .dm-type-desc { font-size: 10px; color: #52525b; margin: 1px 0 0; }

        /* ─── Input Area ─────────────────────────────── */
        .dm-input-area {
          padding: 8px 12px;
          padding-bottom: max(8px, env(safe-area-inset-bottom));
          border-top: 1px solid rgba(63,63,70,0.12);
          background: rgba(17,17,22,0.95);
          display: flex; flex-direction: column; gap: 6px;
        }

        .dm-type-btn {
          display: flex; align-items: center; gap: 4px;
          padding: 4px 8px; border: none; border-radius: 6px;
          cursor: pointer; font-size: 11px; font-weight: 600;
          width: fit-content; transition: all 0.12s;
        }
        .dm-type-btn.type-auto { background: linear-gradient(135deg, rgba(251,146,60,0.15), rgba(168,85,247,0.15)); color: #fb923c; }
        .dm-type-btn.type-task { background: rgba(168,85,247,0.15); color: #c084fc; }
        .dm-type-btn.type-command { background: rgba(59,130,246,0.15); color: #60a5fa; }
        .dm-type-btn.type-question { background: rgba(234,179,8,0.15); color: #fbbf24; }
        .dm-type-btn.type-chat { background: rgba(34,197,94,0.15); color: #4ade80; }

        .dm-input-row { display: flex; align-items: flex-end; gap: 6px; }
        .dm-text-input {
          flex: 1; border: 1px solid #222228;
          background: #16161c; color: #fafafa;
          padding: 9px 12px; border-radius: 16px;
          font-size: 13px; font-family: inherit;
          resize: none; outline: none;
          line-height: 1.4; max-height: 120px;
          transition: border-color 0.2s;
        }
        .dm-text-input::placeholder { color: #3f3f46; }
        .dm-text-input:focus { border-color: #4f46e5; }

        .dm-send-btn {
          width: 36px; height: 36px;
          border-radius: 50%; border: none;
          background: linear-gradient(135deg, #4f46e5, #6366f1);
          color: white; display: flex; align-items: center;
          justify-content: center; cursor: pointer;
          transition: all 0.15s; flex-shrink: 0;
        }
        .dm-send-btn:hover:not(:disabled) { transform: scale(1.05); box-shadow: 0 3px 12px rgba(99,102,241,0.3); }
        .dm-send-btn:disabled { opacity: 0.3; cursor: default; }

        /* ─── Attachment UI ──────────────────────────── */
        .dm-attach-btn {
          width: 36px; height: 36px; border-radius: 50%;
          border: none; background: transparent; color: #52525b;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.15s; flex-shrink: 0;
        }
        .dm-attach-btn:hover { background: rgba(255,255,255,0.06); color: #a1a1aa; }

        .dm-attached-chip {
          display: flex; align-items: center; gap: 6px;
          padding: 5px 10px; border-radius: 8px;
          background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
          font-size: 11px; color: #818cf8; max-width: 100%;
        }
        .dm-attached-chip span {
          flex: 1; white-space: nowrap; overflow: hidden;
          text-overflow: ellipsis; min-width: 0;
        }
        .dm-chip-remove {
          background: none; border: none; color: #52525b;
          cursor: pointer; font-size: 11px; padding: 0 2px;
          flex-shrink: 0;
        }
        .dm-chip-remove:hover { color: #ef4444; }

        .dm-minutes-picker {
          position: absolute; bottom: 80px; left: 12px; right: 12px;
          background: #1a1a20; border: 1px solid #222228;
          border-radius: 14px; z-index: 21;
          box-shadow: 0 -6px 24px rgba(0,0,0,0.5);
          animation: dmSlideUp2 0.15s ease-out;
          max-height: 320px; display: flex; flex-direction: column;
        }
        .dm-minutes-picker-header {
          display: flex; align-items: center; gap: 6px;
          padding: 12px 14px; border-bottom: 1px solid #222228;
          font-size: 12px; font-weight: 600; color: #a1a1aa;
        }
        .dm-minutes-loading {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 24px; color: #52525b; font-size: 12px;
        }
        .dm-minutes-empty {
          padding: 24px; text-align: center;
          color: #3f3f46; font-size: 12px;
        }
        .dm-minutes-list {
          overflow-y: auto; flex: 1;
        }
        .dm-minutes-list::-webkit-scrollbar { width: 3px; }
        .dm-minutes-list::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }
        .dm-minutes-item {
          display: block; width: 100%; padding: 10px 14px;
          border: none; border-bottom: 1px solid rgba(63,63,70,0.08);
          background: transparent; color: inherit; text-align: left;
          cursor: pointer; transition: background 0.12s;
        }
        .dm-minutes-item:hover { background: rgba(99,102,241,0.06); }
        .dm-minutes-item:last-child { border-bottom: none; }
        .dm-minutes-item-top {
          display: flex; justify-content: space-between;
          align-items: center; margin-bottom: 3px;
        }
        .dm-minutes-date { font-size: 11px; font-weight: 600; color: #e4e4e7; }
        .dm-minutes-duration { font-size: 10px; color: #52525b; }
        .dm-minutes-summary {
          font-size: 11px; color: #71717a; margin: 0 0 4px;
          line-height: 1.3; display: -webkit-box;
          -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .dm-minutes-agents { display: flex; gap: 4px; flex-wrap: wrap; }
        .dm-minutes-agent-tag {
          font-size: 9px; font-weight: 600; text-transform: capitalize;
          padding: 1px 6px; border-radius: 4px;
          background: rgba(63,63,70,0.2); color: #71717a;
        }

        /* ─── New Messages Indicator ─────────────── */
        .dm-new-msg-btn {
          position: absolute; bottom: 90px; left: 50%; transform: translateX(-50%);
          display: flex; align-items: center; gap: 5px;
          padding: 6px 14px; border-radius: 20px;
          background: rgba(99,102,241,0.9); color: #fff;
          border: none; cursor: pointer; font-size: 11px; font-weight: 600;
          box-shadow: 0 4px 16px rgba(99,102,241,0.3);
          z-index: 20; animation: dmSlideUp2 0.2s ease-out;
          transition: background 0.15s;
        }
        .dm-new-msg-btn:hover { background: rgba(99,102,241,1); }

        /* ─── File Browser ──────────────────────────── */
        .dm-file-chip { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.2); color: #4ade80; }
        .dm-file-size { font-size: 9px; color: #52525b; flex-shrink: 0; }

        .dm-file-browser {
          position: absolute; bottom: 80px; left: 12px; right: 12px;
          background: #1a1a20; border: 1px solid #222228;
          border-radius: 14px; z-index: 22;
          box-shadow: 0 -6px 24px rgba(0,0,0,0.5);
          animation: dmSlideUp2 0.15s ease-out;
          max-height: 340px; display: flex; flex-direction: column;
        }
        .dm-fb-header {
          display: flex; align-items: center; gap: 6px;
          padding: 10px 14px; border-bottom: 1px solid #222228;
          font-size: 11px; font-weight: 600; color: #a1a1aa;
        }
        .dm-fb-path {
          flex: 1; font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 11px; color: #818cf8;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .dm-fb-up, .dm-fb-close {
          background: none; border: none; color: #52525b;
          cursor: pointer; font-size: 10px; font-weight: 600;
          padding: 3px 6px; border-radius: 4px;
          transition: all 0.12s;
        }
        .dm-fb-up:hover { background: rgba(99,102,241,0.1); color: #818cf8; }
        .dm-fb-close:hover { color: #ef4444; }
        .dm-fb-loading {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 24px; color: #52525b; font-size: 12px;
        }
        .dm-fb-list { overflow-y: auto; flex: 1; }
        .dm-fb-list::-webkit-scrollbar { width: 3px; }
        .dm-fb-list::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }
        .dm-fb-item {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 7px 14px; border: none;
          border-bottom: 1px solid rgba(63,63,70,0.06);
          background: transparent; color: inherit; text-align: left;
          cursor: pointer; transition: background 0.12s; font-size: 12px;
        }
        .dm-fb-item:hover { background: rgba(99,102,241,0.06); }
        .dm-fb-item:last-child { border-bottom: none; }
        .dm-fb-icon { font-size: 13px; flex-shrink: 0; width: 18px; text-align: center; }
        .dm-fb-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .dm-fb-name { color: #d4d4d8; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dm-fb-parent { font-size: 9px; color: #3f3f46; font-family: 'SF Mono', 'Fira Code', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dm-fb-count { font-size: 9px; color: #3f3f46; }
        .dm-fb-size { font-size: 9px; color: #3f3f46; flex-shrink: 0; }
        .dm-fb-empty { padding: 20px; text-align: center; color: #3f3f46; font-size: 11px; }

        /* ─── Mobile: Full Screen Chat ───────────────── */
        @media (max-width: 767px) {
          .dm-back-btn { display: flex; }
          .dm-chat { height: 100vh; height: 100dvh; }
        }
      `}</style>
        </div>
    );
};
