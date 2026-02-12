import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, Send, Sparkles, MessageSquare, AtSign } from 'lucide-react';
import { groupChatService } from '../../api/firebase/groupChat/service';
import { presenceService, AgentPresence } from '../../api/firebase/presence/service';
import type { GroupChatMessage } from '../../api/firebase/groupChat/types';
import { MessageBubble } from './MessageBubble';

interface GroupChatModalProps {
  chatId: string;
  participants: string[];
  onClose: (messages: GroupChatMessage[]) => void;
}

const AGENT_COLORS: Record<string, string> = {
  nora: '#22c55e',
  antigravity: '#8b5cf6',
  scout: '#f59e0b',
  solara: '#f43f5e',
  default: '#3b82f6',
};

const AGENT_EMOJIS: Record<string, string> = {
  nora: '⚡',
  antigravity: '🌌',
  scout: '🕵️',
  solara: '❤️‍🔥',
};

export const GroupChatModal: React.FC<GroupChatModalProps> = ({
  chatId,
  participants,
  onClose,
}) => {
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentPresence>>({});
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Listen to messages
  useEffect(() => {
    const unsubscribe = groupChatService.listenToMessages(chatId, (newMessages) => {
      setMessages(newMessages);
    });
    return () => unsubscribe();
  }, [chatId]);

  // Listen to agent presence
  useEffect(() => {
    const unsubscribe = presenceService.listen((agents) => {
      const statusMap: Record<string, AgentPresence> = {};
      agents.forEach(agent => { statusMap[agent.id] = agent; });
      setAgentStatuses(statusMap);
    });
    return () => unsubscribe();
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    setSending(true);
    try {
      await groupChatService.broadcastMessage(chatId, inputText.trim(), participants);
      setInputText('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle @ mention detection
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputText(value);

    // Check for @ trigger
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setShowMentions(true);
      setMentionFilter(atMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
      setMentionFilter('');
    }
  }, []);

  // Insert mention
  const insertMention = useCallback((agentId: string, agentName: string) => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart || 0;
    const textBeforeCursor = inputText.substring(0, cursorPos);
    const textAfterCursor = inputText.substring(cursorPos);

    // Replace the @partial with @agentName
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const newText = textBeforeCursor.substring(0, atIndex) + `@${agentName} ` + textAfterCursor;
    setInputText(newText);
    setShowMentions(false);

    // Refocus
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = atIndex + agentName.length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  }, [inputText]);

  const handleClose = () => {
    const hasActiveResponses = messages.some(msg =>
      Object.values(msg.responses).some(r => r.status === 'processing')
    );
    if (hasActiveResponses) {
      const confirmed = window.confirm('Some agents are still responding. Close anyway?');
      if (!confirmed) return;
    }
    onClose(messages);
  };

  const agentNames: Record<string, string> = {};
  participants.forEach(agentId => {
    agentNames[agentId] = agentStatuses[agentId]?.displayName || agentId;
  });

  // Filter mention suggestions
  const mentionSuggestions = participants.filter(agentId => {
    const name = (agentStatuses[agentId]?.displayName || agentId).toLowerCase();
    return name.includes(mentionFilter);
  });

  // Count total responses
  const totalResponses = messages.reduce((sum, msg) => {
    return sum + Object.values(msg.responses).filter(r => r.status === 'completed').length;
  }, 0);

  // Compute which agents are currently typing (pending or processing)
  const typingAgents: { id: string; name: string; emoji: string; color: string }[] = [];
  messages.forEach(msg => {
    Object.entries(msg.responses).forEach(([agentId, response]) => {
      if (response.status === 'pending' || response.status === 'processing') {
        if (!typingAgents.find(a => a.id === agentId)) {
          typingAgents.push({
            id: agentId,
            name: agentNames[agentId] || agentId,
            emoji: AGENT_EMOJIS[agentId] || '🤖',
            color: AGENT_COLORS[agentId] || AGENT_COLORS.default,
          });
        }
      }
    });
  });

  return ReactDOM.createPortal(
    <div className="rt-overlay" onClick={handleClose}>
      <div className="rt-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="rt-header">
          <div className="rt-header-left">
            <div className="rt-header-icon">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="rt-title">Round Table</h2>
              <p className="rt-subtitle">
                {participants.length} agents
                {totalResponses > 0 && ` · ${totalResponses} responses`}
              </p>
            </div>
          </div>
          <div className="rt-header-right">
            {/* Agent presence dots */}
            <div className="rt-presence-dots">
              {participants.map(agentId => {
                const color = AGENT_COLORS[agentId] || AGENT_COLORS.default;
                const emoji = AGENT_EMOJIS[agentId] || '🤖';
                const name = agentStatuses[agentId]?.displayName || agentId;
                return (
                  <div
                    key={agentId}
                    className="rt-presence-dot"
                    title={name}
                    style={{ background: `${color}20`, borderColor: `${color}50` }}
                  >
                    <span>{emoji}</span>
                  </div>
                );
              })}
            </div>
            <button className="rt-close" onClick={handleClose}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="rt-messages">
          {messages.length === 0 && (
            <div className="rt-empty">
              <div className="rt-empty-icon">
                <MessageSquare className="w-7 h-7" />
              </div>
              <p className="rt-empty-title">Start a round table discussion</p>
              <p className="rt-empty-desc">
                Your message will be sent to all agents.
                Use <span className="rt-at-example">@name</span> to address a specific agent.
              </p>
            </div>
          )}

          {messages.map(message => (
            <MessageBubble
              key={message.id}
              message={message}
              agentNames={agentNames}
              agentEmojis={AGENT_EMOJIS}
              agentColors={AGENT_COLORS}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Typing indicator ── */}
        {typingAgents.length > 0 && (
          <div className="rt-typing-bar">
            <div className="rt-typing-avatars">
              {typingAgents.map(agent => (
                <span key={agent.id} className="rt-typing-emoji" title={agent.name}>
                  {agent.emoji}
                </span>
              ))}
            </div>
            <span className="rt-typing-text">
              {typingAgents.length === 1
                ? `${typingAgents[0].name} is typing`
                : typingAgents.length === 2
                  ? `${typingAgents[0].name} and ${typingAgents[1].name} are typing`
                  : `${typingAgents[0].name} and ${typingAgents.length - 1} others are typing`
              }
            </span>
            <div className="rt-typing-dots">
              <span /><span /><span />
            </div>
          </div>
        )}

        {/* ── Mention dropdown ── */}
        {showMentions && mentionSuggestions.length > 0 && (
          <div className="rt-mention-dropdown">
            {mentionSuggestions.map(agentId => {
              const name = agentStatuses[agentId]?.displayName || agentId;
              const emoji = AGENT_EMOJIS[agentId] || '🤖';
              const color = AGENT_COLORS[agentId] || AGENT_COLORS.default;
              return (
                <button
                  key={agentId}
                  className="rt-mention-item"
                  onClick={() => insertMention(agentId, name)}
                >
                  <span className="rt-mention-emoji">{emoji}</span>
                  <span className="rt-mention-name" style={{ color }}>{name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Input ── */}
        <div className="rt-input-area">
          <div className="rt-input-row">
            <button
              className="rt-at-btn"
              onClick={() => {
                const cur = inputText;
                setInputText(cur + '@');
                setShowMentions(true);
                setMentionFilter('');
                setTimeout(() => inputRef.current?.focus(), 10);
              }}
              title="Mention an agent"
            >
              <AtSign className="w-4 h-4" />
            </button>
            <textarea
              ref={inputRef}
              className="rt-textarea"
              placeholder="Message all agents…"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              maxLength={2000}
              rows={1}
              disabled={sending}
            />
            <button
              className="rt-send"
              onClick={handleSend}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <div className="rt-spinner" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="rt-input-hint">
            <kbd>↵</kbd> to send · <kbd>⇧</kbd> + <kbd>↵</kbd> new line · <kbd>@</kbd> to mention
          </p>
        </div>
      </div>

      <style jsx>{`
        /* ═══ OVERLAY ═══ */
        .rt-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: rtFadeIn 0.25s ease-out;
        }

        @keyframes rtFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* ═══ MODAL ═══ */
        .rt-modal {
          width: 580px;
          max-width: 100%;
          height: 75vh;
          max-height: 680px;
          background: rgba(12, 15, 20, 0.97);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.03),
            0 24px 80px rgba(0, 0, 0, 0.7),
            0 0 120px rgba(139, 92, 246, 0.06);
          animation: rtSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes rtSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ═══ HEADER ═══ */
        .rt-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .rt-header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rt-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rt-header-icon {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.2));
          border: 1px solid rgba(139, 92, 246, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #a78bfa;
        }

        .rt-title {
          font-size: 14px;
          font-weight: 700;
          color: #fafafa;
          margin: 0;
        }

        .rt-subtitle {
          font-size: 10px;
          color: #52525b;
          margin: 1px 0 0;
        }

        .rt-presence-dots {
          display: flex;
          gap: 4px;
        }

        .rt-presence-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1.5px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }

        .rt-close {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          color: #52525b;
          cursor: pointer;
          transition: all 0.15s;
        }

        .rt-close:hover {
          background: rgba(255, 255, 255, 0.04);
          color: #a1a1aa;
        }

        /* ═══ MESSAGES ═══ */
        .rt-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 18px;
          min-height: 0;
          scrollbar-width: thin;
          scrollbar-color: rgba(63,63,70,0.3) transparent;
        }

        .rt-messages::-webkit-scrollbar { width: 5px; }
        .rt-messages::-webkit-scrollbar-track { background: transparent; }
        .rt-messages::-webkit-scrollbar-thumb {
          background: rgba(63,63,70,0.3);
          border-radius: 4px;
        }

        /* ═══ EMPTY STATE ═══ */
        .rt-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 200px;
          text-align: center;
          gap: 8px;
        }

        .rt-empty-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: rgba(139, 92, 246, 0.07);
          border: 1px solid rgba(139, 92, 246, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6d28d9;
          margin-bottom: 4px;
        }

        .rt-empty-title {
          font-size: 14px;
          font-weight: 600;
          color: #d4d4d8;
          margin: 0;
        }

        .rt-empty-desc {
          font-size: 12px;
          color: #52525b;
          margin: 0;
          max-width: 260px;
          line-height: 1.5;
        }

        .rt-at-example {
          color: #a78bfa;
          font-weight: 600;
        }

        /* ═══ MENTION DROPDOWN ═══ */
        .rt-mention-dropdown {
          position: absolute;
          bottom: 90px;
          left: 18px;
          right: 18px;
          background: rgba(24, 24, 27, 0.98);
          border: 1px solid rgba(63, 63, 70, 0.3);
          border-radius: 12px;
          padding: 4px;
          z-index: 10;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
          animation: rtDropIn 0.15s ease-out;
        }

        @keyframes rtDropIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .rt-mention-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          border: none;
          background: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.1s;
        }

        .rt-mention-item:hover {
          background: rgba(139, 92, 246, 0.1);
        }

        .rt-mention-emoji { font-size: 16px; }
        .rt-mention-name { font-size: 13px; font-weight: 600; }

        /* ═══ INPUT AREA ═══ */
        .rt-input-area {
          padding: 12px 18px 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
        }

        .rt-input-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }

        .rt-at-btn {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          color: #52525b;
          cursor: pointer;
          transition: all 0.15s;
        }

        .rt-at-btn:hover {
          background: rgba(139,92,246,0.1);
          border-color: rgba(139,92,246,0.25);
          color: #a78bfa;
        }

        .rt-textarea {
          flex: 1;
          min-height: 36px;
          max-height: 100px;
          resize: none;
          background: rgba(24, 24, 27, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 8px 14px;
          color: #e4e4e7;
          font-size: 13px;
          font-family: inherit;
          line-height: 1.5;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .rt-textarea:focus {
          border-color: rgba(139, 92, 246, 0.35);
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.06);
        }

        .rt-textarea::placeholder { color: #3f3f46; }
        .rt-textarea:disabled { opacity: 0.4; cursor: not-allowed; }

        .rt-send {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #7c3aed, #6366f1);
          border: none;
          border-radius: 10px;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .rt-send:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(124, 58, 237, 0.35);
        }

        .rt-send:active:not(:disabled) { transform: translateY(0); }
        .rt-send:disabled { opacity: 0.3; cursor: not-allowed; }

        .rt-input-hint {
          margin: 6px 0 0;
          font-size: 9px;
          color: #3f3f46;
          text-align: right;
        }

        .rt-input-hint kbd {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 3px;
          padding: 0px 4px;
          font-size: 9px;
          font-family: inherit;
          color: #52525b;
        }

        .rt-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.25);
          border-top-color: white;
          border-radius: 50%;
          animation: rtSpin 0.7s linear infinite;
        }

        @keyframes rtSpin {
          to { transform: rotate(360deg); }
        }

        /* ═══ TYPING INDICATOR ═══ */
        .rt-typing-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-top: 1px solid rgba(255,255,255,0.02);
          animation: rtTypingFadeIn 0.3s ease-out;
        }

        @keyframes rtTypingFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .rt-typing-avatars {
          display: flex;
          gap: 2px;
        }

        .rt-typing-emoji {
          font-size: 14px;
        }

        .rt-typing-text {
          font-size: 11px;
          color: #71717a;
          font-weight: 500;
        }

        .rt-typing-dots {
          display: flex;
          gap: 3px;
          margin-left: 2px;
        }

        .rt-typing-dots span {
          width: 4px;
          height: 4px;
          background: #52525b;
          border-radius: 50%;
          animation: rtDotBounce 1.3s infinite ease-in-out;
        }

        .rt-typing-dots span:nth-child(2) { animation-delay: 0.15s; }
        .rt-typing-dots span:nth-child(3) { animation-delay: 0.3s; }

        @keyframes rtDotBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
          30% { transform: translateY(-3px); opacity: 1; }
        }

        @media (max-width: 768px) {
          .rt-overlay { padding: 0; }
          .rt-modal {
            width: 100vw;
            height: 100vh;
            max-height: 100vh;
            border-radius: 0;
          }
        }
      `}</style>
    </div>,
    document.body
  );
};
