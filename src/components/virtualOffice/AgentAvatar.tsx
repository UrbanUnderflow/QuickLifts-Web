import React from 'react';

interface AgentAvatarProps {
  agentId: string;
  emoji: string;
  name: string;
  status: 'working' | 'idle' | 'offline';
  isTyping?: boolean;
  color: string;
}

export const AgentAvatar: React.FC<AgentAvatarProps> = ({
  emoji,
  name,
  status,
  isTyping = false,
  color,
}) => {
  const statusColors = {
    working: '#22c55e',
    idle: '#f59e0b',
    offline: '#71717a',
  };

  return (
    <div className="agent-avatar-container">
      <div
        className={`avatar-circle ${isTyping ? 'typing' : ''}`}
        style={{
          borderColor: statusColors[status],
          boxShadow: `0 0 12px ${statusColors[status]}40`,
        }}
      >
        <span className="avatar-emoji">{emoji}</span>
        {isTyping && (
          <div className="typing-overlay">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>
      <p className="avatar-name" style={{ color }}>{name}</p>
      <div className="status-badge" style={{ background: statusColors[status] }} />

      <style jsx>{`
        .agent-avatar-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          min-width: 70px;
        }

        .avatar-circle {
          position: relative;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 2px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(24, 24, 27, 0.8), rgba(39, 39, 42, 0.6));
          transition: all 0.3s ease;
        }

        .avatar-circle.typing {
          animation: avatarPulse 1.5s ease-in-out infinite;
        }

        @keyframes avatarPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .avatar-emoji {
          font-size: 28px;
        }

        .typing-overlay {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.15);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .typing-dots {
          display: flex;
          gap: 3px;
        }

        .typing-dots span {
          width: 4px;
          height: 4px;
          background: #3b82f6;
          border-radius: 50%;
          animation: typingDotBounce 1.4s infinite;
        }

        .typing-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typingDotBounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          30% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }

        .avatar-name {
          font-size: 11px;
          font-weight: 600;
          margin: 0;
          text-align: center;
        }

        .status-badge {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          border: 2px solid #030508;
        }
      `}</style>
    </div>
  );
};
