import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { X, Send, Users } from 'lucide-react';
import { groupChatService } from '../../api/firebase/groupChat/service';
import { presenceService, AgentPresence } from '../../api/firebase/presence/service';
import type { GroupChatMessage } from '../../api/firebase/groupChat/types';
import { MessageBubble } from './MessageBubble';
import { AgentAvatar } from './AgentAvatar';

interface GroupChatModalProps {
  chatId: string;
  participants: string[];
  onClose: () => void;
}

const AGENT_COLORS: Record<string, string> = {
  nora: '#22c55e',
  antigravity: '#8b5cf6',
  scout: '#f59e0b',
  default: '#3b82f6',
};

const AGENT_EMOJIS: Record<string, string> = {
  nora: '⚡',
  antigravity: '🌌',
  scout: '🕵️',
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
      agents.forEach(agent => {
        statusMap[agent.id] = agent;
      });
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
    inputRef.current?.focus();
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
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    // Check if any agent is still processing
    const hasActiveResponses = messages.some(msg =>
      Object.values(msg.responses).some(r => r.status === 'processing')
    );

    if (hasActiveResponses) {
      const confirmed = window.confirm(
        'Some agents are still responding. Close anyway?'
      );
      if (!confirmed) return;
    }

    onClose();
  };

  // Get agent names from presence data
  const agentNames: Record<string, string> = {};
  participants.forEach(agentId => {
    agentNames[agentId] = agentStatuses[agentId]?.displayName || agentId;
  });

  // Check if any agent is typing
  const typingAgents = new Set<string>();
  messages.forEach(msg => {
    Object.entries(msg.responses).forEach(([agentId, response]) => {
      if (response.status === 'processing') {
        typingAgents.add(agentId);
      }
    });
  });

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-left">
            <Users className="w-5 h-5 text-purple-400" />
            <h2>Round Table Collaboration</h2>
            <span className="participant-count">{participants.length} agents</span>
          </div>
          <button
            className="close-button"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Agent Row */}
        <div className="agent-row">
          {participants.map(agentId => {
            const agent = agentStatuses[agentId];
            const emoji = AGENT_EMOJIS[agentId] || agent?.emoji || '🤖';
            const name = agent?.displayName || agentId;
            const status = agent?.status || 'offline';
            const color = AGENT_COLORS[agentId] || AGENT_COLORS.default;
            const isTyping = typingAgents.has(agentId);

            return (
              <AgentAvatar
                key={agentId}
                agentId={agentId}
                emoji={emoji}
                name={name}
                status={status}
                isTyping={isTyping}
                color={color}
              />
            );
          })}
        </div>

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 && (
            <div className="empty-state">
              <p className="empty-icon">💬</p>
              <p className="empty-text">Start the conversation</p>
              <p className="empty-subtext">
                Your message will be sent to all {participants.length} agents
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

        {/* Input */}
        <div className="input-container">
          <textarea
            ref={inputRef}
            className="message-input"
            placeholder="Type your message... (Cmd/Ctrl + Enter to send)"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={2000}
            rows={1}
            style={{
              minHeight: '40px',
              maxHeight: '120px',
              resize: 'none',
            }}
            disabled={sending}
          />
          <button
            className="send-button"
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            aria-label="Send message"
          >
            {sending ? (
              <div className="spinner" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.2s ease-out;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          .modal-container {
            width: 900px;
            max-width: 95vw;
            height: 80vh;
            max-height: 700px;
            background: linear-gradient(145deg, rgba(17, 24, 39, 0.98), rgba(9, 9, 11, 0.98));
            border: 1px solid rgba(139, 92, 246, 0.2);
            border-radius: 20px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6),
                        0 0 40px rgba(139, 92, 246, 0.1);
            animation: slideUp 0.3s ease-out;
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px;
            border-bottom: 1px solid rgba(63, 63, 70, 0.2);
            background: rgba(139, 92, 246, 0.03);
          }

          .header-left {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .modal-header h2 {
            font-size: 18px;
            font-weight: 700;
            color: #fff;
            margin: 0;
          }

          .participant-count {
            font-size: 12px;
            color: #a78bfa;
            background: rgba(139, 92, 246, 0.15);
            padding: 4px 10px;
            border-radius: 12px;
            border: 1px solid rgba(139, 92, 246, 0.3);
          }

          .close-button {
            background: none;
            border: none;
            color: #71717a;
            cursor: pointer;
            padding: 8px;
            border-radius: 8px;
            transition: all 0.2s;
          }

          .close-button:hover {
            color: #f4f4f5;
            background: rgba(63, 63, 70, 0.3);
          }

          .agent-row {
            display: flex;
            gap: 16px;
            padding: 16px 24px;
            border-bottom: 1px solid rgba(63, 63, 70, 0.2);
            overflow-x: auto;
            background: rgba(24, 24, 27, 0.4);
          }

          .agent-row::-webkit-scrollbar {
            height: 4px;
          }

          .agent-row::-webkit-scrollbar-track {
            background: transparent;
          }

          .agent-row::-webkit-scrollbar-thumb {
            background: rgba(139, 92, 246, 0.3);
            border-radius: 4px;
          }

          .messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px 24px;
            background: rgba(3, 5, 8, 0.5);
          }

          .messages-container::-webkit-scrollbar {
            width: 6px;
          }

          .messages-container::-webkit-scrollbar-track {
            background: transparent;
          }

          .messages-container::-webkit-scrollbar-thumb {
            background: rgba(139, 92, 246, 0.2);
            border-radius: 4px;
          }

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            opacity: 0.6;
          }

          .empty-icon {
            font-size: 48px;
            margin-bottom: 12px;
          }

          .empty-text {
            font-size: 16px;
            font-weight: 600;
            color: #e4e4e7;
            margin: 0 0 6px;
          }

          .empty-subtext {
            font-size: 13px;
            color: #71717a;
            margin: 0;
          }

          .input-container {
            display: flex;
            gap: 12px;
            padding: 16px 24px;
            border-top: 1px solid rgba(63, 63, 70, 0.2);
            background: rgba(17, 24, 39, 0.6);
          }

          .message-input {
            flex: 1;
            background: rgba(24, 24, 27, 0.8);
            border: 1px solid rgba(63, 63, 70, 0.3);
            border-radius: 12px;
            padding: 10px 14px;
            color: #e4e4e7;
            font-size: 14px;
            font-family: inherit;
            line-height: 1.5;
            outline: none;
            transition: border-color 0.2s;
          }

          .message-input:focus {
            border-color: #8b5cf6;
            box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
          }

          .message-input:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .message-input::placeholder {
            color: #71717a;
          }

          .send-button {
            flex-shrink: 0;
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #8b5cf6, #6366f1);
            border: none;
            border-radius: 12px;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          }

          .send-button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(139, 92, 246, 0.3);
          }

          .send-button:active:not(:disabled) {
            transform: translateY(0);
          }

          .send-button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }

          .spinner {
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          @media (max-width: 768px) {
            .modal-container {
              width: 100vw;
              height: 100vh;
              max-width: 100vw;
              max-height: 100vh;
              border-radius: 0;
            }

            .agent-row {
              gap: 12px;
            }
          }
        `}</style>
      </div>
    </div>,
    document.body
  );
};
