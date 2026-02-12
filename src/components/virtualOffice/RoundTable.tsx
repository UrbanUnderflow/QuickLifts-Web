import React from 'react';

interface RoundTableProps {
  isActive: boolean;
  onClick: () => void;
  participantCount: number;
}

export const RoundTable: React.FC<RoundTableProps> = ({
  isActive,
  onClick,
  participantCount,
}) => {
  return (
    <div
      className={`round-table-container ${isActive ? 'active' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Start collaboration session with ${participantCount} agents`}
      aria-pressed={isActive}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Table surface */}
      <svg
        className="table-svg"
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Shadow/depth */}
        <ellipse
          cx="100"
          cy="105"
          rx="95"
          ry="90"
          fill="rgba(0,0,0,0.3)"
          filter="blur(8px)"
        />
        
        {/* Table top - wood gradient */}
        <ellipse
          cx="100"
          cy="100"
          rx="90"
          ry="85"
          fill="url(#woodGradient)"
          stroke="#2d1810"
          strokeWidth="2"
        />

        {/* Wood grain texture overlay */}
        <ellipse
          cx="100"
          cy="100"
          rx="85"
          ry="80"
          fill="url(#grainPattern)"
          opacity="0.15"
        />

        {/* Highlight/shine */}
        <ellipse
          cx="100"
          cy="85"
          rx="60"
          ry="30"
          fill="rgba(255,255,255,0.08)"
          opacity="0.6"
        />

        {/* Glow (when active) */}
        {isActive && (
          <ellipse
            cx="100"
            cy="100"
            rx="92"
            ry="87"
            fill="none"
            stroke="url(#glowGradient)"
            strokeWidth="3"
            className="table-glow-ring"
          />
        )}

        {/* Gradient definitions */}
        <defs>
          <radialGradient id="woodGradient">
            <stop offset="0%" stopColor="#6b4423" />
            <stop offset="50%" stopColor="#5c3a24" />
            <stop offset="100%" stopColor="#3f2b1f" />
          </radialGradient>

          <linearGradient id="grainPattern" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4a2f1a" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#6b4423" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#3f2b1f" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="glowGradient">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.6" />
          </linearGradient>
        </defs>
      </svg>

      {/* Participant counter badge */}
      {participantCount > 0 && (
        <div className="participant-badge">
          <span className="participant-count">{participantCount}</span>
        </div>
      )}

      {/* Tooltip */}
      <div className="table-tooltip">
        {isActive ? 'Collaboration in progress' : 'Start collaboration session'}
      </div>

      <style jsx>{`
        .round-table-container {
          position: absolute;
          left: 50%;
          top: 57%;
          transform: translate(-50%, -50%);
          width: 220px;
          height: 220px;
          cursor: pointer;
          z-index: 4;
          transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
        }

        .round-table-container:hover {
          transform: translate(-50%, -50%) scale(1.05);
        }

        .round-table-container:focus {
          outline: 2px solid #3b82f6;
          outline-offset: 4px;
          border-radius: 50%;
        }

        .round-table-container.active {
          animation: tablePulse 2s ease-in-out infinite;
        }

        @keyframes tablePulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.3));
          }
          50% {
            transform: translate(-50%, -50%) scale(1.03);
            filter: drop-shadow(0 0 40px rgba(139, 92, 246, 0.5));
          }
        }

        .table-svg {
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.4));
        }

        .table-glow-ring {
          animation: glowPulse 1.5s ease-in-out infinite;
        }

        @keyframes glowPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        .participant-badge {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #030508;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }

        .participant-count {
          color: white;
          font-size: 14px;
          font-weight: 700;
        }

        .table-tooltip {
          position: absolute;
          bottom: -40px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.9);
          color: #e4e4e7;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s;
          border: 1px solid rgba(139, 92, 246, 0.3);
        }

        .round-table-container:hover .table-tooltip {
          opacity: 1;
        }

        @media (prefers-reduced-motion: reduce) {
          .round-table-container.active {
            animation: none;
            filter: drop-shadow(0 0 30px rgba(139, 92, 246, 0.4));
          }
          .table-glow-ring {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
};
