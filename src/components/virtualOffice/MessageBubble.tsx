import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { GroupChatMessage } from '../../api/firebase/groupChat/types';

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

/**
 * Flat chat-stream message bubble for the Round Table.
 * Renders admin messages as outgoing, agent follow-ups as incoming,
 * and only completed/failed agent responses as standalone bubbles.
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  agentNames,
  agentEmojis,
  agentColors,
}) => {
  // Only show completed or failed responses as bubbles
  const visibleResponses = Object.entries(message.responses).filter(
    ([, response]) => response.status === 'completed' || response.status === 'failed'
  );

  // Determine if this message is from an agent (follow-up from @mention)
  const isFromAgent = message.from !== 'admin';
  const senderAgentId = message.from;
  const senderColor = isFromAgent ? (agentColors[senderAgentId] || '#3b82f6') : '';
  const senderName = isFromAgent
    ? (agentNames[senderAgentId] || (message as any).fromName || senderAgentId)
    : '';
  const senderEmoji = isFromAgent ? (agentEmojis[senderAgentId] || '🤖') : '';

  return (
    <>
      {/* ── Sender message ── */}
      {isFromAgent ? (
        /* Agent-initiated follow-up (from @mention) — 
           Show a subtle context indicator so users understand the conversation flow */
        <div className="rt-followup-indicator">
          <span className="rt-followup-line" style={{ borderColor: `${senderColor}30` }} />
          <span className="rt-followup-label" style={{ color: senderColor }}>
            {senderEmoji} {senderName} replied
          </span>
          <span className="rt-followup-line" style={{ borderColor: `${senderColor}30` }} />
        </div>
      ) : (
        /* Admin (You) message — outgoing, right-aligned */
        <div className="rt-bubble rt-bubble-out">
          <div className="rt-bubble-content rt-out">
            <p className="rt-bubble-text">{message.content}</p>
            <span className="rt-bubble-time">{formatTime(message.createdAt)}</span>
          </div>
        </div>
      )}

      {/* ── Agent responses ── only completed/failed, as flat chat bubbles */}
      {visibleResponses.map(([agentId, response]) => {
        const color = agentColors[agentId] || '#3b82f6';
        const name = agentNames[agentId] || agentId;
        const emoji = agentEmojis[agentId] || '🤖';

        return (
          <div key={agentId} className="rt-bubble rt-bubble-in">
            <div className="rt-avatar" style={{ background: `${color}18`, borderColor: `${color}40` }}>
              <span>{emoji}</span>
            </div>
            <div className="rt-bubble-content rt-in">
              <div className="rt-bubble-sender">
                <span style={{ color }}>{name}</span>
                {response.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5 text-green-500 opacity-50" />}
                {response.status === 'failed' && <XCircle className="w-2.5 h-2.5 text-red-400" />}
              </div>
              {response.status === 'completed' && response.content && (
                <p className="rt-bubble-text">{response.content}</p>
              )}
              {response.status === 'failed' && (
                <p className="rt-bubble-text rt-error">
                  {response.error || 'Failed to respond'}
                </p>
              )}
              {response.completedAt && (
                <span className="rt-bubble-time">{formatTime(response.completedAt)}</span>
              )}
            </div>
          </div>
        );
      })}

      <style jsx>{`
        .rt-bubble {
          display: flex;
          margin-bottom: 6px;
          max-width: 85%;
          animation: rtBubbleIn 0.25s ease-out;
        }

        @keyframes rtBubbleIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .rt-bubble-content {
          border-radius: 16px;
          padding: 10px 14px;
          line-height: 1.5;
        }

        .rt-bubble-text {
          font-size: 13px;
          margin: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        .rt-bubble-time {
          display: block;
          font-size: 9px;
          color: #52525b;
          margin-top: 4px;
          text-align: right;
        }

        .rt-bubble-out {
          justify-content: flex-end;
          margin-left: auto;
        }

        .rt-out {
          background: linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.18));
          border: 1px solid rgba(139,92,246,0.15);
          border-bottom-right-radius: 4px;
          color: #e4e4e7;
        }

        .rt-bubble-in {
          justify-content: flex-start;
          gap: 8px;
          align-items: flex-end;
        }

        .rt-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1.5px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
          margin-bottom: 2px;
        }

        .rt-in {
          background: rgba(24,24,27,0.7);
          border: 1px solid rgba(63,63,70,0.2);
          border-bottom-left-radius: 4px;
          color: #d4d4d8;
        }

        .rt-followup {
          border-left: 2px solid rgba(139,92,246,0.3);
        }

        .rt-followup-tag {
          font-size: 9px;
          color: #71717a;
          font-style: italic;
        }

        .rt-bubble-sender {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .rt-followup-indicator {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 8px 0 4px;
          padding: 0 8px;
        }

        .rt-followup-line {
          flex: 1;
          height: 0;
          border-bottom: 1px dashed;
        }

        .rt-followup-label {
          font-size: 10px;
          font-weight: 500;
          white-space: nowrap;
          opacity: 0.7;
        }

        .rt-error { color: #fca5a5; font-style: italic; }
      `}</style>
    </>
  );
};
