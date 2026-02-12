import React from 'react';
import { CheckCircle2, Loader2, XCircle, Clock } from 'lucide-react';
import type { GroupChatMessage, AgentResponse } from '../../api/firebase/groupChat/types';

interface MessageBubbleProps {
  message: GroupChatMessage;
  agentNames: Record<string, string>;
  agentEmojis: Record<string, string>;
  agentColors: Record<string, string>;
}

const formatTime = (date: Date | any): string => {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ResponseStatus: React.FC<{ status: AgentResponse['status'] }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-3 h-3 text-green-400" />;
    case 'processing':
      return <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />;
    case 'failed':
      return <XCircle className="w-3 h-3 text-red-400" />;
    default:
      return <Clock className="w-3 h-3 text-zinc-600" />;
  }
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  agentNames,
  agentEmojis,
  agentColors,
}) => {
  const responseCount = Object.keys(message.responses).length;
  const completedCount = Object.values(message.responses).filter(
    r => r.status === 'completed'
  ).length;

  return (
    <div className="message-bubble-container">
      {/* Admin message */}
      <div className="admin-message">
        <div className="message-header">
          <span className="message-from">You</span>
          <span className="message-time">{formatTime(message.createdAt)}</span>
        </div>
        <div className="message-content">{message.content}</div>
        <div className="message-footer">
          <span className="response-count">
            {completedCount}/{responseCount} responses
          </span>
        </div>
      </div>

      {/* Agent responses */}
      <div className="agent-responses">
        {Object.entries(message.responses).map(([agentId, response]) => {
          const agentColor = agentColors[agentId] || '#3b82f6';
          const agentName = agentNames[agentId] || agentId;
          const emoji = agentEmojis[agentId] || '🤖';

          return (
            <div
              key={agentId}
              className="agent-response"
              style={{ borderLeftColor: agentColor }}
            >
              <div className="response-header">
                <div className="agent-info">
                  <span className="agent-emoji">{emoji}</span>
                  <span className="agent-name" style={{ color: agentColor }}>
                    {agentName}
                  </span>
                </div>
                <ResponseStatus status={response.status} />
              </div>
              
              {response.status === 'processing' && (
                <div className="response-content typing">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}

              {response.status === 'completed' && response.content && (
                <div className="response-content">{response.content}</div>
              )}

              {response.status === 'failed' && (
                <div className="response-content error">
                  {response.error || 'Failed to respond'}
                </div>
              )}

              {response.status === 'pending' && (
                <div className="response-content pending">Waiting...</div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .message-bubble-container {
          margin-bottom: 24px;
        }

        .admin-message {
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          border-radius: 12px;
          padding: 12px 16px;
          margin-bottom: 8px;
        }

        .message-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .message-from {
          font-size: 12px;
          font-weight: 600;
          color: #3b82f6;
        }

        .message-time {
          font-size: 10px;
          color: #71717a;
        }

        .message-content {
          font-size: 13px;
          color: #e4e4e7;
          line-height: 1.5;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .message-footer {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px solid rgba(63, 63, 70, 0.2);
        }

        .response-count {
          font-size: 10px;
          color: #71717a;
        }

        .agent-responses {
          padding-left: 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .agent-response {
          background: rgba(24, 24, 27, 0.6);
          border-left: 3px solid;
          border-radius: 0 8px 8px 0;
          padding: 10px 12px;
        }

        .response-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .agent-info {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .agent-emoji {
          font-size: 14px;
        }

        .agent-name {
          font-size: 11px;
          font-weight: 600;
        }

        .response-content {
          font-size: 12px;
          color: #d4d4d8;
          line-height: 1.5;
        }

        .response-content.typing {
          padding: 4px 0;
        }

        .response-content.error {
          color: #fca5a5;
          font-style: italic;
        }

        .response-content.pending {
          color: #71717a;
          font-style: italic;
        }

        .typing-indicator {
          display: inline-flex;
          gap: 4px;
        }

        .typing-indicator span {
          width: 6px;
          height: 6px;
          background: #71717a;
          border-radius: 50%;
          animation: typingBounce 1.4s infinite;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typingBounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-6px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
