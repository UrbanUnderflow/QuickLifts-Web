# Round Table Collaboration - Technical Implementation Plan

## Overview

This document provides a step-by-step implementation guide for building the Round Table Collaboration feature. Each phase includes specific file changes, code snippets, and testing procedures.

---

## Project Structure

### New Files to Create
```
src/
├── components/
│   └── virtualOffice/
│       ├── RoundTable.tsx              (NEW)
│       ├── GroupChatModal.tsx          (NEW)
│       ├── AgentAvatar.tsx             (NEW)
│       └── MessageBubble.tsx           (NEW)
├── api/
│   └── firebase/
│       └── groupChat/
│           ├── service.ts              (NEW)
│           ├── types.ts                (NEW)
│           └── __tests__/
│               └── service.test.ts     (NEW)
├── utils/
│   └── tablePositions.ts               (NEW)
└── hooks/
    └── useGroupChat.ts                 (NEW)
```

### Files to Modify
```
src/
├── pages/
│   └── admin/
│       └── virtualOffice.tsx           (MODIFY - add table & modal)
└── api/
    └── firebase/
        └── presence/
            └── service.ts              (MODIFY - add group chat support)
```

---

## Phase 1: Layout & Table Element

### Step 1.1: Create RoundTable Component

**File**: `src/components/virtualOffice/RoundTable.tsx`

```typescript
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
```

### Step 1.2: Add Table to Virtual Office

**File**: `src/pages/admin/virtualOffice.tsx`

**Changes:**
1. Import RoundTable component
2. Add collaboration state
3. Render table in office floor

```typescript
// At top of file, add import
import { RoundTable } from '../../components/virtualOffice/RoundTable';

// Inside VirtualOfficeContent component, add state
const [isCollaborating, setIsCollaborating] = useState(false);
const [groupChatId, setGroupChatId] = useState<string | null>(null);

// Add handler
const handleTableClick = useCallback(() => {
  if (isCollaborating) {
    // Close collaboration
    setIsCollaborating(false);
    setGroupChatId(null);
  } else {
    // Start collaboration
    setIsCollaborating(true);
    console.log('Starting collaboration with agents:', allAgents.map(a => a.id));
    // TODO: Open modal and animate agents
  }
}, [isCollaborating, allAgents]);

// In the JSX, inside .office-floor div, after OfficeDecorations:
<OfficeDecorations />

{/* Round Table for Collaboration */}
<RoundTable
  isActive={isCollaborating}
  onClick={handleTableClick}
  participantCount={allAgents.length}
/>

{allAgents.map((agent, i) => (
  // ... existing AgentDeskSprite code
))}
```

**Test:** 
- Table should render in center of office
- Hover shows tooltip
- Click toggles `isCollaborating` state
- Active state shows pulsing glow

---

## Phase 2: Agent Movement System

### Step 2.1: Create Position Utilities

**File**: `src/utils/tablePositions.ts`

```typescript
export interface Position {
  x: number; // percentage from left
  y: number; // percentage from top
  facing?: 'left' | 'right' | 'inward';
}

export interface TableConfig {
  centerX: number;    // % from left
  centerY: number;    // % from top
  radiusPx: number;   // pixels
}

const DEFAULT_TABLE_CONFIG: TableConfig = {
  centerX: 50,
  centerY: 57,
  radiusPx: 200,
};

/**
 * Calculate position around the table for a given agent index
 * @param agentIndex - 0-based index of agent in participant list
 * @param totalAgents - Total number of agents at table
 * @param config - Table configuration (optional)
 * @param containerWidth - Container width in pixels (for % calculation)
 * @param containerHeight - Container height in pixels (for % calculation)
 */
export const getTablePosition = (
  agentIndex: number,
  totalAgents: number,
  config: TableConfig = DEFAULT_TABLE_CONFIG,
  containerWidth = 1200,
  containerHeight = 750
): Position => {
  // Start at top (12 o'clock) and go clockwise
  const angleOffset = -Math.PI / 2; // Start at top
  const angle = angleOffset + (agentIndex / totalAgents) * 2 * Math.PI;

  // Calculate position in pixels
  const xPx = config.radiusPx * Math.cos(angle);
  const yPx = config.radiusPx * Math.sin(angle);

  // Convert to percentages relative to container
  const xPercent = config.centerX + (xPx / containerWidth) * 100;
  const yPercent = config.centerY + (yPx / containerHeight) * 100;

  return {
    x: xPercent,
    y: yPercent,
    facing: 'inward',
  };
};

/**
 * Calculate all table positions for a group of agents
 */
export const getAllTablePositions = (
  agentIds: string[],
  config?: TableConfig,
  containerWidth?: number,
  containerHeight?: number
): Record<string, Position> => {
  const positions: Record<string, Position> = {};
  
  agentIds.forEach((agentId, index) => {
    positions[agentId] = getTablePosition(
      index,
      agentIds.length,
      config,
      containerWidth,
      containerHeight
    );
  });

  return positions;
};

/**
 * Get the standard desk position for an agent by index
 */
export const getDeskPosition = (agentIndex: number): Position => {
  const DESK_POSITIONS: Position[] = [
    { x: 22, y: 42, facing: 'right' },
    { x: 58, y: 42, facing: 'left' },
    { x: 22, y: 72, facing: 'right' },
    { x: 58, y: 72, facing: 'left' },
    { x: 40, y: 26, facing: 'right' },
    { x: 40, y: 86, facing: 'left' },
  ];

  // Cycle through positions if more agents than desks
  return DESK_POSITIONS[agentIndex % DESK_POSITIONS.length];
};

/**
 * Calculate animation delay for staggered entrance
 * @param agentIndex - Index in the agent list
 * @param delayMs - Delay between each agent (default 150ms)
 */
export const getStaggerDelay = (
  agentIndex: number,
  delayMs = 150
): number => {
  return agentIndex * delayMs;
};

/**
 * Calculate animation delay for staggered exit (reverse order)
 */
export const getExitStaggerDelay = (
  agentIndex: number,
  totalAgents: number,
  delayMs = 150
): number => {
  return (totalAgents - 1 - agentIndex) * delayMs;
};
```

### Step 2.2: Update AgentDeskSprite for Dynamic Positioning

**File**: `src/pages/admin/virtualOffice.tsx`

**Changes to AgentDeskSprite:**

```typescript
interface AgentDeskProps {
  agent: AgentPresence;
  position: { x: number; y: number; facing: 'left' | 'right' | 'inward' };
  isTransitioning?: boolean;      // NEW
  transitionDelay?: number;       // NEW
}

const AgentDeskSprite: React.FC<AgentDeskProps> = ({ 
  agent, 
  position,
  isTransitioning = false,
  transitionDelay = 0,
}) => {
  const [hovered, setHovered] = useState(false);
  // ... existing state ...

  return (
    <div
      ref={spriteRef}
      className={`agent-desk-sprite ${isTransitioning ? 'transitioning' : ''}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transitionDelay: isTransitioning ? `${transitionDelay}ms` : '0ms',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ... existing content ... */}
      
      {/* Character with walking animation during transition */}
      <div className={`office-character ${agent.status} ${
        isOnCoffeeBreak ? 'coffee-walk' : ''
      } ${
        isTransitioning ? 'walking' : ''
      }`}>
        {/* ... existing character markup ... */}
      </div>
      
      {/* ... rest of sprite content ... */}
    </div>
  );
};
```

**Add to styles section:**

```css
.agent-desk-sprite.transitioning {
  transition: 
    left 2s cubic-bezier(0.4, 0.0, 0.2, 1),
    top 2s cubic-bezier(0.4, 0.0, 0.2, 1);
  z-index: 15; /* Above other agents during transition */
}

.office-character.walking {
  animation: characterWalk 0.6s steps(4) infinite;
}

.office-character.walking .char-arm {
  animation: armSwing 0.6s ease-in-out infinite alternate !important;
}

.office-character.walking .char-head {
  animation: headBob 0.6s ease-in-out infinite;
}

@keyframes characterWalk {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-2px) rotate(-1deg); }
  50% { transform: translateY(0) rotate(0deg); }
  75% { transform: translateY(-2px) rotate(1deg); }
}

@keyframes armSwing {
  0% { transform: rotate(-25deg); }
  100% { transform: rotate(25deg); }
}

@keyframes headBob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-1px); }
}
```

### Step 2.3: Implement Position State Management

**File**: `src/pages/admin/virtualOffice.tsx`

```typescript
// Add imports
import { 
  getAllTablePositions, 
  getDeskPosition, 
  getStaggerDelay, 
  getExitStaggerDelay 
} from '../../utils/tablePositions';

// Add state
type AgentPositionState = 'desk' | 'table' | 'transitioning-to-table' | 'transitioning-to-desk';

interface AgentPositionInfo {
  state: AgentPositionState;
  position: { x: number; y: number; facing: 'left' | 'right' | 'inward' };
  transitionDelay: number;
}

const [agentPositions, setAgentPositions] = useState<Record<string, AgentPositionInfo>>({});

// Initialize positions when agents load
useEffect(() => {
  const initialPositions: Record<string, AgentPositionInfo> = {};
  allAgents.forEach((agent, index) => {
    initialPositions[agent.id] = {
      state: 'desk',
      position: getDeskPosition(index),
      transitionDelay: 0,
    };
  });
  setAgentPositions(initialPositions);
}, [allAgents.length]); // Only re-init if agent count changes

// Handler to start collaboration
const startCollaboration = useCallback(async () => {
  setIsCollaborating(true);

  // Calculate table positions
  const agentIds = allAgents.map(a => a.id);
  const tablePositions = getAllTablePositions(agentIds);

  // Update positions with stagger
  const updatedPositions = { ...agentPositions };
  agentIds.forEach((agentId, index) => {
    updatedPositions[agentId] = {
      state: 'transitioning-to-table',
      position: tablePositions[agentId],
      transitionDelay: getStaggerDelay(index),
    };
  });
  setAgentPositions(updatedPositions);

  // After animation completes, mark as "at table"
  const lastAgentDelay = getStaggerDelay(agentIds.length - 1);
  setTimeout(() => {
    const finalPositions = { ...updatedPositions };
    agentIds.forEach(agentId => {
      finalPositions[agentId].state = 'table';
      finalPositions[agentId].transitionDelay = 0;
    });
    setAgentPositions(finalPositions);
  }, lastAgentDelay + 2000); // 2s transition duration

}, [allAgents, agentPositions]);

// Handler to end collaboration
const endCollaboration = useCallback(async () => {
  const agentIds = allAgents.map(a => a.id);

  // Update positions with reverse stagger
  const updatedPositions = { ...agentPositions };
  agentIds.forEach((agentId, index) => {
    updatedPositions[agentId] = {
      state: 'transitioning-to-desk',
      position: getDeskPosition(index),
      transitionDelay: getExitStaggerDelay(index, agentIds.length),
    };
  });
  setAgentPositions(updatedPositions);

  // After animation completes, mark as "at desk"
  const lastExitDelay = getExitStaggerDelay(0, agentIds.length); // First agent out last
  setTimeout(() => {
    const finalPositions = { ...updatedPositions };
    agentIds.forEach(agentId => {
      finalPositions[agentId].state = 'desk';
      finalPositions[agentId].transitionDelay = 0;
    });
    setAgentPositions(finalPositions);
    setIsCollaborating(false);
  }, lastExitDelay + 2000);

}, [allAgents, agentPositions]);

// Update table click handler
const handleTableClick = useCallback(() => {
  if (isCollaborating) {
    endCollaboration();
  } else {
    startCollaboration();
  }
}, [isCollaborating, startCollaboration, endCollaboration]);

// Render agents with dynamic positions
{allAgents.map((agent) => {
  const posInfo = agentPositions[agent.id];
  if (!posInfo) return null; // Position not yet initialized

  return (
    <AgentDeskSprite
      key={agent.id}
      agent={agent}
      position={posInfo.position}
      isTransitioning={posInfo.state.includes('transitioning')}
      transitionDelay={posInfo.transitionDelay}
    />
  );
})}
```

**Test:**
- Click table → agents should animate to table positions in sequence
- Positions should form a circle around the table
- Click again → agents return to desks in reverse order

---

## Phase 3: Group Chat Backend

### Step 3.1: Create Firestore Types

**File**: `src/api/firebase/groupChat/types.ts`

```typescript
import { Timestamp } from 'firebase/firestore';

export interface GroupChat {
  id?: string;
  participants: string[];
  createdBy: 'admin';
  createdAt: Timestamp | Date;
  lastMessageAt: Timestamp | Date;
  status: 'active' | 'closed';
  metadata?: {
    sessionDuration?: number;
    messageCount?: number;
  };
}

export interface AgentResponse {
  content: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: Timestamp | Date;
  completedAt?: Timestamp | Date;
  error?: string;
}

export interface GroupChatMessage {
  id?: string;
  from: 'admin';
  content: string;
  createdAt: Timestamp | Date;
  broadcastedAt?: Timestamp | Date;
  responses: Record<string, AgentResponse>;
  allCompleted: boolean;
}

export interface GroupChatCommand {
  id?: string;
  from: 'admin';
  to: string;
  type: 'group-chat';
  content: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  createdAt: Timestamp | Date;
  completedAt?: Timestamp | Date;
  groupChatId: string;
  messageId: string;
  context: {
    otherAgents: string[];
    previousMessages?: Array<{
      from: string;
      content: string;
    }>;
  };
}
```

### Step 3.2: Create Group Chat Service

**File**: `src/api/firebase/groupChat/service.ts`

```typescript
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config';
import type {
  GroupChat,
  GroupChatMessage,
  GroupChatCommand,
  AgentResponse,
} from './types';

export class GroupChatService {
  /**
   * Create a new group chat session
   */
  async createSession(participantIds: string[]): Promise<string> {
    const chatData: Omit<GroupChat, 'id'> = {
      participants: participantIds,
      createdBy: 'admin',
      createdAt: serverTimestamp() as Timestamp,
      lastMessageAt: serverTimestamp() as Timestamp,
      status: 'active',
      metadata: {
        messageCount: 0,
        sessionDuration: 0,
      },
    };

    const chatRef = await addDoc(collection(db, 'agent-group-chats'), chatData);
    return chatRef.id;
  }

  /**
   * Broadcast a message to all participants
   */
  async broadcastMessage(
    chatId: string,
    content: string,
    participants: string[]
  ): Promise<string> {
    // 1. Add message to chat
    const messageData: Omit<GroupChatMessage, 'id'> = {
      from: 'admin',
      content,
      createdAt: serverTimestamp() as Timestamp,
      broadcastedAt: serverTimestamp() as Timestamp,
      responses: {},
      allCompleted: false,
    };

    const messageRef = await addDoc(
      collection(db, `agent-group-chats/${chatId}/messages`),
      messageData
    );

    // 2. Create agent commands in batch
    const batch = writeBatch(db);

    participants.forEach((agentId) => {
      const commandRef = doc(collection(db, 'agent-commands'));
      const commandData: Omit<GroupChatCommand, 'id'> = {
        from: 'admin',
        to: agentId,
        type: 'group-chat',
        content,
        status: 'pending',
        createdAt: serverTimestamp() as Timestamp,
        groupChatId: chatId,
        messageId: messageRef.id,
        context: {
          otherAgents: participants.filter(id => id !== agentId),
        },
      };
      batch.set(commandRef, commandData);

      // Initialize response placeholder
      messageData.responses[agentId] = {
        content: '',
        status: 'pending',
      };
    });

    // Update message with response placeholders
    batch.update(messageRef, {
      responses: messageData.responses,
    });

    await batch.commit();

    // 3. Update chat metadata
    await updateDoc(doc(db, 'agent-group-chats', chatId), {
      lastMessageAt: serverTimestamp(),
      'metadata.messageCount': (await this.getMessageCount(chatId)) + 1,
    });

    return messageRef.id;
  }

  /**
   * Update agent response for a message
   */
  async updateAgentResponse(
    chatId: string,
    messageId: string,
    agentId: string,
    response: Partial<AgentResponse>
  ): Promise<void> {
    const messageRef = doc(db, `agent-group-chats/${chatId}/messages`, messageId);
    
    const updateData: any = {};
    if (response.content !== undefined) {
      updateData[`responses.${agentId}.content`] = response.content;
    }
    if (response.status) {
      updateData[`responses.${agentId}.status`] = response.status;
    }
    if (response.startedAt) {
      updateData[`responses.${agentId}.startedAt`] = response.startedAt;
    }
    if (response.completedAt) {
      updateData[`responses.${agentId}.completedAt`] = response.completedAt;
    }
    if (response.error) {
      updateData[`responses.${agentId}.error`] = response.error;
    }

    await updateDoc(messageRef, updateData);
  }

  /**
   * Mark message as all responses completed
   */
  async markMessageComplete(chatId: string, messageId: string): Promise<void> {
    const messageRef = doc(db, `agent-group-chats/${chatId}/messages`, messageId);
    await updateDoc(messageRef, {
      allCompleted: true,
    });
  }

  /**
   * Close a group chat session
   */
  async closeSession(chatId: string): Promise<void> {
    await updateDoc(doc(db, 'agent-group-chats', chatId), {
      status: 'closed',
      closedAt: serverTimestamp(),
    });
  }

  /**
   * Listen to messages in a chat
   */
  listenToMessages(
    chatId: string,
    callback: (messages: GroupChatMessage[]) => void
  ): Unsubscribe {
    const messagesQuery = query(
      collection(db, `agent-group-chats/${chatId}/messages`),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(messagesQuery, (snapshot) => {
      const messages: GroupChatMessage[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<GroupChatMessage, 'id'>),
      }));
      callback(messages);
    });
  }

  /**
   * Get message count for a chat
   */
  private async getMessageCount(chatId: string): Promise<number> {
    // This is a simple implementation - in production, use aggregation
    return 0; // Placeholder
  }
}

// Export singleton instance
export const groupChatService = new GroupChatService();
```

### Step 3.3: Update Virtual Office to Use Service

**File**: `src/pages/admin/virtualOffice.tsx`

```typescript
// Add import
import { groupChatService } from '../../api/firebase/groupChat/service';

// Update startCollaboration handler
const startCollaboration = useCallback(async () => {
  try {
    setIsCollaborating(true);

    // Create group chat session
    const agentIds = allAgents.map(a => a.id);
    const chatId = await groupChatService.createSession(agentIds);
    setGroupChatId(chatId);

    // Animate agents to table
    const tablePositions = getAllTablePositions(agentIds);
    const updatedPositions = { ...agentPositions };
    agentIds.forEach((agentId, index) => {
      updatedPositions[agentId] = {
        state: 'transitioning-to-table',
        position: tablePositions[agentId],
        transitionDelay: getStaggerDelay(index),
      };
    });
    setAgentPositions(updatedPositions);

    // Mark as "at table" after animation
    setTimeout(() => {
      const finalPositions = { ...updatedPositions };
      agentIds.forEach(agentId => {
        finalPositions[agentId].state = 'table';
        finalPositions[agentId].transitionDelay = 0;
      });
      setAgentPositions(finalPositions);
      
      // TODO: Open modal here in Phase 4
    }, getStaggerDelay(agentIds.length - 1) + 2000);

  } catch (error) {
    console.error('Failed to start collaboration:', error);
    setIsCollaborating(false);
    // Show error toast
  }
}, [allAgents, agentPositions]);
```

**Test:**
- Click table should create a Firestore document in `agent-group-chats`
- Document should have correct participants array
- Status should be 'active'

---

## Phase 4: Group Chat Modal UI

### Step 4.1: Create Message Bubble Component

**File**: `src/components/virtualOffice/MessageBubble.tsx`

```typescript
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
```

### Step 4.2: Create Agent Avatar Component

**File**: `src/components/virtualOffice/AgentAvatar.tsx`

```typescript
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
```

### Step 4.3: Create Group Chat Modal

**File**: `src/components/virtualOffice/GroupChatModal.tsx`

```typescript
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
```

### Step 4.4: Integrate Modal into Virtual Office

**File**: `src/pages/admin/virtualOffice.tsx`

```typescript
// Add import
import { GroupChatModal } from '../../components/virtualOffice/GroupChatModal';

// Add state for modal visibility
const [showGroupChatModal, setShowGroupChatModal] = useState(false);

// Update startCollaboration to show modal after animation
const startCollaboration = useCallback(async () => {
  // ... existing animation code ...

  setTimeout(() => {
    const finalPositions = { ...updatedPositions };
    agentIds.forEach(agentId => {
      finalPositions[agentId].state = 'table';
      finalPositions[agentId].transitionDelay = 0;
    });
    setAgentPositions(finalPositions);
    
    // Open modal
    setShowGroupChatModal(true);
  }, getStaggerDelay(agentIds.length - 1) + 2000);
}, [allAgents, agentPositions]);

// Update endCollaboration to close modal first
const endCollaboration = useCallback(async () => {
  // Close modal
  setShowGroupChatModal(false);

  // Close Firestore session
  if (groupChatId) {
    await groupChatService.closeSession(groupChatId);
  }

  // ... existing animation code ...
}, [allAgents, agentPositions, groupChatId]);

// Render modal at end of component
return (
  <div className="voffice-root">
    {/* ... existing content ... */}

    {/* Group Chat Modal */}
    {showGroupChatModal && groupChatId && (
      <GroupChatModal
        chatId={groupChatId}
        participants={allAgents.map(a => a.id)}
        onClose={endCollaboration}
      />
    )}

    <style jsx global>{/* ... existing styles ... */}</style>
  </div>
);
```

**Test:**
- Click table → agents animate → modal opens
- Send message → appears in feed
- Modal shows all agents
- Close modal → agents return to desks

---

## Testing & Validation

### Manual Testing Checklist

**Phase 1: Table Element**
- [ ] Table renders in center of office
- [ ] Hover shows tooltip
- [ ] Click handler fires (check console)
- [ ] Active state shows glow effect
- [ ] Keyboard accessible (Tab, Enter/Space)

**Phase 2: Agent Animation**
- [ ] Agents move to table on click
- [ ] Positions form a circle
- [ ] Stagger delay visible (sequential movement)
- [ ] Walking animation plays during transition
- [ ] Reverse animation works (return to desks)
- [ ] No visual glitches or jumps

**Phase 3: Backend**
- [ ] Firestore document created in `agent-group-chats`
- [ ] Participants array correct
- [ ] Agent commands created (one per agent)
- [ ] Messages collection exists
- [ ] Real-time listeners work

**Phase 4: Modal**
- [ ] Modal opens after animation completes
- [ ] Agent row displays all participants
- [ ] Typing indicator works
- [ ] Messages display correctly
- [ ] Send button works
- [ ] Keyboard shortcut (Cmd+Enter) works
- [ ] Close modal triggers return animation

---

## Next Steps

1. **Review this implementation plan**
2. **Set up development branch**: `feature/round-table-collaboration`
3. **Create Firestore collections** in staging environment
4. **Begin Phase 1 implementation**
5. **Schedule design review** after Phase 1 complete

---

**Document Version**: 1.0  
**Last Updated**: 2024-02-11  
**Author**: Scout (AI Engineer)  
**Status**: Ready for Implementation  
