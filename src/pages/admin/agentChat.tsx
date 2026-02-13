import React, { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { AGENT_ROLES, AGENT_EMOJIS } from '../../utils/agentConstants';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { presenceService, AgentPresence } from '../../api/firebase/presence/service';
import { db } from '../../api/firebase/config';
import {
  collection, addDoc, serverTimestamp, query, where, orderBy,
  onSnapshot, limit, doc, updateDoc
} from 'firebase/firestore';
import {
  ArrowLeft, Send, Zap, MessageSquare, ListTodo,
  HelpCircle, Terminal, ChevronDown, Loader2, CheckCircle2,
  Circle, AlertCircle
} from 'lucide-react';

/* ─── Types ───────────────────────────────────────────── */

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

type MessageType = 'auto' | 'task' | 'command' | 'question' | 'chat';

const MESSAGE_TYPES: { type: MessageType; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'auto', label: 'Auto', icon: <Zap className="w-4 h-4" />, desc: 'AI detects intent — task, command, question, or chat' },
  { type: 'task', label: 'Task', icon: <ListTodo className="w-4 h-4" />, desc: 'Assign work — agent decomposes & executes' },
  { type: 'command', label: 'Command', icon: <Terminal className="w-4 h-4" />, desc: 'Direct instruction — immediate action' },
  { type: 'question', label: 'Question', icon: <HelpCircle className="w-4 h-4" />, desc: 'Ask for info or status' },
  { type: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" />, desc: 'General conversation — no task execution' },
];

/* ─── Helpers ─────────────────────────────────────────── */

/* AGENT_EMOJIS and AGENT_ROLES imported from utils/agentConstants.ts */

const AGENT_ID_ALIASES: Record<string, string> = {
  branddirector: 'solara',
};

const normalizeIncomingAgents = (incoming: AgentPresence[]): AgentPresence[] => {
  const merged = new Map<string, { agent: AgentPresence; canonicalSource: boolean }>();

  for (const rawAgent of incoming) {
    const canonicalId = AGENT_ID_ALIASES[rawAgent.id] ?? rawAgent.id;
    const normalized: AgentPresence = {
      ...rawAgent,
      id: canonicalId,
      displayName: canonicalId === 'solara' ? 'Solara' : rawAgent.displayName,
      emoji: canonicalId === 'solara'
        ? (rawAgent.emoji || AGENT_EMOJIS.solara)
        : rawAgent.emoji,
    };

    const candidate = { agent: normalized, canonicalSource: rawAgent.id === canonicalId };
    const existing = merged.get(canonicalId);

    if (!existing) {
      merged.set(canonicalId, candidate);
      continue;
    }

    if (candidate.canonicalSource !== existing.canonicalSource) {
      if (candidate.canonicalSource) merged.set(canonicalId, candidate);
      continue;
    }

    const candidateUpdatedAt = candidate.agent.lastUpdate?.getTime() ?? 0;
    const existingUpdatedAt = existing.agent.lastUpdate?.getTime() ?? 0;
    if (candidateUpdatedAt >= existingUpdatedAt) merged.set(canonicalId, candidate);
  }

  return Array.from(merged.values()).map((entry) => entry.agent);
};

const AGENT_HEARTBEAT_STALE_MS = 2 * 60_000;
const OFFLINE_RESPONSE_TIMEOUT_MS = 45_000;

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

const isAgentStale = (agent?: AgentPresence | null) => {
  if (!agent?.lastUpdate) return true;
  return (Date.now() - agent.lastUpdate.getTime()) > AGENT_HEARTBEAT_STALE_MS;
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
  const router = useRouter();

  return (
    <div className="ac-agent-list">
      <div className="ac-list-header">
        <div>
          <button
            onClick={() => router.push('/admin/virtualOffice')}
            className="ac-back-button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              marginBottom: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#a1a1aa',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = '#a1a1aa';
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Virtual Office</span>
          </button>
          <p className="ac-list-subtitle">Agent Comms</p>
          <h1 className="ac-list-title">Messages</h1>
        </div>
        <div className="ac-header-badge">
          <Zap className="w-4 h-4" />
          <span>{agents.filter(a => a.status !== 'offline' && !isAgentStale(a)).length} online</span>
        </div>
      </div>

      <div className="ac-agents">
        {agents.map((agent) => {
          const stale = isAgentStale(agent);
          const displayStatus = stale ? 'offline' : agent.status;
          const preview = displayStatus === 'working' && agent.currentTask
            ? `🔨 ${agent.currentTask}`
            : displayStatus === 'idle'
              ? (agent.notes || '💤 Waiting for tasks...')
              : '🔴 Offline - agent runner not connected';

          return (
            <button
              key={agent.id}
              className="ac-agent-row"
              onClick={() => onSelectAgent(agent)}
            >
              <div className="ac-agent-avatar">
                <span className="ac-avatar-emoji">{agent.emoji || AGENT_EMOJIS[agent.id] || '🤖'}</span>
                <div className="ac-status-dot" style={{ background: statusColor(displayStatus) }} />
              </div>
              <div className="ac-agent-info">
                <div className="ac-agent-name-row">
                  <span className="ac-agent-name">{agent.displayName}</span>
                  {agent.lastUpdate && (
                    <span className="ac-agent-time">{formatRelative(agent.lastUpdate)}</span>
                  )}
                </div>
                <p className="ac-agent-role">{AGENT_ROLES[agent.id] || 'Agent'}</p>
                <p className="ac-agent-preview">{preview}</p>
              </div>
              <div className="ac-agent-chevron">›</div>
            </button>
          );
        })}
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
  const [msgType, setMsgType] = useState<MessageType>('auto');
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoFailedMessageIdsRef = useRef<Set<string>>(new Set());
  const agentIsStale = isAgentStale(agent);
  const agentIsOnline = agent.status !== 'offline' && !agentIsStale;

  // Listen for messages involving this agent (BOTH directions)
  useEffect(() => {
    const commandsRef = collection(db, 'agent-commands');

    // Query 1: Messages sent TO the agent (user → agent)
    const qTo = query(
      commandsRef,
      where('to', '==', agent.id),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    // Query 2: Messages sent FROM the agent (agent → user, proactive messages)
    const qFrom = query(
      commandsRef,
      where('from', '==', agent.id),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    // Track results from both listeners and merge
    let toMsgs: ChatMessage[] = [];
    let fromMsgs: ChatMessage[] = [];

    const mergAndSet = () => {
      // Combine, deduplicate by id, sort oldest-first
      const map = new Map<string, ChatMessage>();
      [...toMsgs, ...fromMsgs].forEach(m => map.set(m.id, m));
      const merged = Array.from(map.values()).sort(
        (a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0)
      );
      setMessages(merged);
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
      (snapshot) => {
        setError(null);
        toMsgs = snapshot.docs.map(mapDoc);
        mergAndSet();
      },
      (err) => {
        console.error('Firestore listener error (to):', err);
        if (err.message?.includes('index')) {
          setError('Missing Firestore index. Check console for the creation link.');
        } else {
          setError(`Firestore error: ${err.message}`);
        }
      }
    );

    const unsub2 = onSnapshot(qFrom,
      (snapshot) => {
        fromMsgs = snapshot.docs.map(mapDoc);
        mergAndSet();
      },
      (err) => {
        console.error('Firestore listener error (from):', err);
        // from-query index: from (asc) + createdAt (desc)
        if (err.message?.includes('index')) {
          setError('Missing Firestore index for agent messages. Check console for the creation link.');
        }
      }
    );

    return () => { unsub1(); unsub2(); };
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

    // Optimistic UI — show bubble immediately
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      from: 'admin',
      to: agent.id,
      type: msgType,
      content: text,
      status: 'pending',
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setInputText('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

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
      // Firestore listener will replace the optimistic message with the real one
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setError(`Send failed: ${err.message}`);
      // Remove the optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setTimeout(() => setError(null), 5000);
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // If the agent runner is offline and a message sits pending, fail it with a clear response.
  useEffect(() => {
    if (agentIsOnline) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const stalePending = messages.filter((msg) => {
        if (msg.from !== 'admin' || msg.to !== agent.id || msg.response) return false;
        if (msg.status !== 'pending' && msg.status !== 'in-progress') return false;
        if (msg.id.startsWith('optimistic-')) return false;
        if (autoFailedMessageIdsRef.current.has(msg.id)) return false;
        if (!msg.createdAt) return false;
        return now - msg.createdAt.getTime() >= OFFLINE_RESPONSE_TIMEOUT_MS;
      });

      stalePending.forEach(async (msg) => {
        autoFailedMessageIdsRef.current.add(msg.id);
        try {
          await updateDoc(doc(db, 'agent-commands', msg.id), {
            status: 'failed',
            response: `${agent.displayName} is currently offline. Please restart the agent runner and resend this message.`,
            completedAt: serverTimestamp(),
          });
        } catch (err) {
          console.error('Failed to auto-fail stale message:', err);
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [agent.id, agent.displayName, agentIsOnline, messages]);

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
            <div className="ac-status-dot-sm" style={{ background: statusColor(agentIsOnline ? agent.status : 'offline') }} />
          </div>
          <div>
            <h2 className="ac-chat-name">{agent.displayName}</h2>
            <p className="ac-chat-status">
              {!agentIsOnline
                ? 'Offline'
                : agent.status === 'working'
                  ? `Working: ${agent.currentTask || 'task'}`
                  : agent.status === 'idle' ? 'Online · Idle' : 'Offline'
              }
            </p>
          </div>
        </div>
        {agentIsOnline && agent.status === 'working' && agent.taskProgress > 0 && (
          <div className="ac-progress-badge">
            <Zap className="w-3 h-3" />
            <span>{agent.taskProgress}%</span>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="ac-error-banner">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ac-error-close">✕</button>
        </div>
      )}

      {!agentIsOnline && (
        <div className="ac-offline-banner">
          <AlertCircle className="w-4 h-4" />
          <span>{agent.displayName} runner is offline. Pending messages auto-fail after 45s with a reconnect hint.</span>
        </div>
      )}

      {/* Messages Area */}
      <div className="ac-messages">
        {messages.length === 0 && (
          <div className="ac-empty-chat">
            <div className="ac-empty-icon">{agent.emoji || AGENT_EMOJIS[agent.id] || '🤖'}</div>
            <h3>Start a conversation with {agent.displayName}</h3>
            <p>Send a task, question, or command. Messages go directly to the agent runner pipeline — real work gets done.</p>
          </div>
        )}

        {messages.map((msg) => {
          // Determine if this is an agent-initiated (proactive) message
          const isProactive = msg.from === agent.id;

          return (
            <div key={msg.id} className="ac-message-group">
              {isProactive ? (
                /* ── Agent-initiated (proactive) message ── */
                <div className="ac-msg ac-msg-in">
                  <div className="ac-msg-avatar-sm">
                    {agent.emoji || AGENT_EMOJIS[agent.id] || '🤖'}
                  </div>
                  <div className="ac-msg-in-content">
                    <div className="ac-msg-bubble ac-bubble-in ac-bubble-proactive">
                      <p>{msg.content}</p>
                    </div>
                    <div className="ac-msg-meta-in">
                      <span className="ac-msg-type-badge type-proactive">
                        {msg.metadata?.proactiveType || 'update'}
                      </span>
                      <span className="ac-msg-time">{msg.createdAt ? formatTime(msg.createdAt) : ''}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── User message (outgoing) ── */
                <>
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
                          <span className="ac-typing">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Thinking
                            <span className="ac-thinking-dots" aria-hidden>
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

  const SCOUT_FALLBACK: AgentPresence = {
    id: 'scout',
    displayName: 'Scout',
    emoji: '🕵️',
    status: 'offline',
    currentTask: '',
    currentTaskId: '',
    notes: 'Agent runner not connected',
    executionSteps: [],
    currentStepIndex: -1,
    taskProgress: 0,
    lastUpdate: new Date(0),
    sessionStartedAt: undefined,
  };

  const SOLARA_FALLBACK: AgentPresence = {
    id: 'solara',
    displayName: 'Solara',
    emoji: '❤️‍🔥',
    status: 'offline',
    currentTask: '',
    currentTaskId: '',
    notes: 'Agent runner not connected',
    executionSteps: [],
    currentStepIndex: -1,
    taskProgress: 0,
    lastUpdate: new Date(0),
    sessionStartedAt: undefined,
  };

  // Listen for agent presence
  useEffect(() => {
    const unsub = presenceService.listen((incoming) => {
      const normalized = normalizeIncomingAgents(incoming);

      // Filter out Antigravity — it communicates directly via the IDE
      const visible = normalized.filter(a => a.id !== 'antigravity');

      // Ensure Scout can always be selected in chat
      if (!visible.some(a => a.id === 'scout')) {
        visible.push(SCOUT_FALLBACK);
      }
      if (!visible.some(a => a.id === 'solara')) {
        visible.push(SOLARA_FALLBACK);
      }

      setAgents(visible.sort((a, b) => a.displayName.localeCompare(b.displayName)));

      // Update selected agent data if we're in a chat
      if (selectedAgent) {
        const updated = visible.find(a => a.id === selectedAgent.id);
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

        /* ─── Error Banner ─────────────────────────────── */
        .ac-error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(239, 68, 68, 0.15);
          border-bottom: 1px solid rgba(239, 68, 68, 0.25);
          color: #fca5a5;
          font-size: 12px;
          animation: slideDown 0.2s ease;
        }

        .ac-error-close {
          margin-left: auto;
          background: none;
          border: none;
          color: #fca5a5;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 14px;
        }

        .ac-error-close:hover {
          background: rgba(239, 68, 68, 0.15);
        }

        .ac-offline-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(245, 158, 11, 0.12);
          border-bottom: 1px solid rgba(245, 158, 11, 0.22);
          color: #fbbf24;
          font-size: 12px;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
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

        .ac-msg-type-badge.type-auto {
          background: linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(168, 85, 247, 0.15));
          color: #fb923c;
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

        .ac-msg-type-badge.type-proactive {
          background: rgba(20, 184, 166, 0.15);
          color: #2dd4bf;
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

        .ac-bubble-proactive {
          border-left: 3px solid #14b8a6;
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

        .ac-thinking-dots {
          display: inline-flex;
          width: 16px;
          justify-content: flex-start;
        }

        .ac-thinking-dots span {
          opacity: 0;
          animation: acThinkingDot 1.2s infinite;
          display: inline-block;
          width: 4px;
        }

        .ac-thinking-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .ac-thinking-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes acThinkingDot {
          0%, 20% { opacity: 0; }
          40%, 80% { opacity: 1; }
          100% { opacity: 0; }
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

        .ac-type-btn.type-auto {
          background: linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(168, 85, 247, 0.15));
          color: #fb923c;
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
