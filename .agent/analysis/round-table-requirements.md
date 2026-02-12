# Round Table Collaboration - Requirements Analysis

## Executive Summary

The Round Table Collaboration feature is a premium, visually stunning addition to the Virtual Office that enables group collaboration sessions. When activated, all agents animate from their individual desks to gather around a central table, opening a group chat modal for multi-agent discussions.

**Key Objectives:**
- Create an immersive, premium visual experience
- Enable efficient multi-agent collaboration
- Maintain architectural consistency with existing patterns
- Provide real-time synchronization and responsive UI

---

## Current System Analysis

### Existing Infrastructure

#### 1. Virtual Office (`src/pages/admin/virtualOffice.tsx`)
**Current Implementation:**
- **Agent Positioning**: Fixed desk positions using percentage-based layout (DESK_POSITIONS array)
- **Agent Rendering**: Individual `AgentDeskSprite` components with absolute positioning
- **Presence System**: Real-time agent status via `presenceService` with Firestore listeners
- **Visual Elements**: Extensive CSS-in-JS styling with decorations (whiteboard, plants, coffee machine, etc.)
- **Agent States**: `working`, `idle`, `offline` with visual indicators
- **Hover Interactions**: Detailed hover panels showing agent info, execution steps, and task history

**Key Features:**
- Live execution step tracking with progress visualization
- Agent profile modals with full role descriptions
- Smooth CSS transitions for animations
- Coffee break animations for idle agents
- Real-time clock and stats strip

#### 2. Agent Communication (`src/pages/admin/agentChat.tsx`)
**Current Implementation:**
- **Message Structure**: `agent-commands` Firestore collection
- **Message Types**: `auto`, `task`, `command`, `question`, `chat`, `email`
- **Message Flow**: 
  - User → Firestore (`agent-commands`)
  - Agent runner picks up command
  - Agent updates with response
- **Status Tracking**: `pending`, `in-progress`, `completed`, `failed`
- **Real-time Updates**: Firestore `onSnapshot` listeners

**Data Model:**
```typescript
interface ChatMessage {
  id: string;
  from: string;           // 'admin' or agent ID
  to: string;             // agent ID or 'admin'
  type: MessageType;
  content: string;
  response?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  createdAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}
```

#### 3. Agent Presence System (`src/api/firebase/presence/service.ts`)
**Current Capabilities:**
- Real-time agent status tracking
- Execution step management
- Task progress monitoring
- Session duration tracking
- Task history with pagination

**Data Structure:**
```typescript
interface AgentPresence {
  id: string;
  displayName: string;
  emoji: string;
  status: 'working' | 'idle' | 'offline';
  currentTask: string;
  currentTaskId: string;
  notes: string;
  executionSteps: AgentThoughtStep[];
  currentStepIndex: number;
  taskProgress: number;
  lastUpdate: Date;
  sessionStartedAt: Date;
}
```

### Technology Stack
- **Frontend**: Next.js (React), TypeScript
- **Database**: Firestore (Firebase)
- **Styling**: CSS-in-JS (styled jsx)
- **Icons**: Lucide React
- **State Management**: React hooks (useState, useEffect, useMemo)

---

## Feature Requirements

### Phase 1: Layout & Table Element

#### 1.1 Round Table SVG Component
**Requirements:**
- Create reusable `RoundTable` component with SVG graphics
- Premium wood texture gradient
- Subtle ambient glow when idle
- Active pulsing glow when collaboration session active
- Responsive sizing (scales with office floor container)
- Click handler for activation

**Visual Specifications:**
- Position: Center of office floor (50%, 50%)
- Size: ~180-220px diameter (responsive)
- Colors: Rich brown (#3f2b1f to #5c3a24) with highlights
- Glow: Subtle purple/indigo (#8b5cf6) at 10-20% opacity
- Active state: Pulsing animation (0.8-1.2 scale, 2s ease-in-out)

**Accessibility:**
- Tooltip: "Start collaboration session"
- Click area minimum 44x44px (WCAG 2.1)
- Keyboard navigation support

#### 1.2 Table Positioning System
**Requirements:**
- Z-index management to ensure table sits above floor decorations but below agents
- Collision detection with existing decorations (no overlap)
- Visual hierarchy: Floor → Rug → Table → Agents

**Implementation Details:**
```typescript
const TABLE_CONFIG = {
  centerX: 50,    // % from left
  centerY: 57,    // % from top
  radius: 200,    // px for agent circle arrangement
  zIndex: 4,      // Above decorations (2-3), below agents (5+)
};
```

---

### Phase 2: Agent Movement System

#### 2.1 Position State Management
**Requirements:**
- Track dual position states: `desk` and `table`
- Smooth transition system between states
- Staggered animation delays for sequential arrival
- Reverse animation for return to desks

**State Structure:**
```typescript
type AgentPositionState = 'desk' | 'table' | 'transitioning';

interface CollaborationState {
  isActive: boolean;
  participantIds: string[];
  agentPositions: Record<string, {
    state: AgentPositionState;
    currentPosition: { x: number; y: number };
    targetPosition: { x: number; y: number };
  }>;
  transitionStartTime: number;
}
```

#### 2.2 Position Calculation
**Desk Positions** (Current - Preserve):
```typescript
const DESK_POSITIONS = [
  { x: 22, y: 42, facing: 'right' },
  { x: 58, y: 42, facing: 'left' },
  { x: 22, y: 72, facing: 'right' },
  { x: 58, y: 72, facing: 'left' },
  { x: 40, y: 26, facing: 'right' },
  { x: 40, y: 86, facing: 'left' },
];
```

**Table Positions** (New - Calculate):
```typescript
const getTablePosition = (
  agentIndex: number,
  totalAgents: number,
  centerX: number,
  centerY: number,
  radius: number
): { x: number; y: number; facing: 'inward' } => {
  const angle = (agentIndex / totalAgents) * 2 * Math.PI - Math.PI / 2; // Start at top
  return {
    x: centerX + (radius * Math.cos(angle)) / window.innerWidth * 100,
    y: centerY + (radius * Math.sin(angle)) / window.innerHeight * 100,
    facing: 'inward',
  };
};
```

#### 2.3 Animation System
**CSS Transition Requirements:**
- Duration: 2s for movement
- Easing: `cubic-bezier(0.4, 0.0, 0.2, 1)` (smooth acceleration/deceleration)
- Properties: `transform`, `left`, `top`
- Stagger delay: 150ms between each agent

**Walking Animation:**
- Character bobbing during transition
- Arms swinging
- Slight rotation toward destination

**Implementation:**
```css
.agent-desk-sprite.transitioning {
  transition: left 2s cubic-bezier(0.4, 0.0, 0.2, 1),
              top 2s cubic-bezier(0.4, 0.0, 0.2, 1),
              transform 2s cubic-bezier(0.4, 0.0, 0.2, 1);
}

.agent-desk-sprite.transitioning .office-character {
  animation: walkCycle 0.6s steps(2) infinite;
}

@keyframes walkCycle {
  0% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
  100% { transform: translateY(0); }
}
```

---

### Phase 3: Group Chat Modal

#### 3.1 Modal Component (`GroupChatModal.tsx`)
**Requirements:**
- Portal rendering (ReactDOM.createPortal)
- Full-screen overlay with backdrop blur
- Centered modal (max-width: 900px, max-height: 80vh)
- Responsive design for mobile/tablet

**Layout Structure:**
```
┌─────────────────────────────────────────┐
│ Header: "Round Table Collaboration"     │
│ Close button (X)                         │
├─────────────────────────────────────────┤
│ Agent Row (horizontal scroll)           │
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐               │
│ │ 🌌│ │ ⚡│ │🕵️│ │...│               │
│ └───┘ └───┘ └───┘ └───┘               │
│ [Name] [Name] [Name]                    │
├─────────────────────────────────────────┤
│                                          │
│ Message Feed (scrollable)                │
│   [Admin]: Message here...               │
│   ├─ [Nora]: Response 1                 │
│   ├─ [Antigravity]: Response 2          │
│   └─ [Scout]: Response 3                │
│                                          │
│   [Admin]: Another message...            │
│   └─ [Nora]: Typing...                  │
│                                          │
├─────────────────────────────────────────┤
│ Input Field                              │
│ [Type your message here...]   [Send]    │
└─────────────────────────────────────────┘
```

#### 3.2 Agent Row Component
**Requirements:**
- Avatar display with emoji/image
- Agent name label
- Status indicator (working/idle/offline)
- Typing indicator overlay
- Responsive horizontal scroll for many agents

**Visual Design:**
- Avatar size: 56px diameter
- Border: 2px solid (color-coded by status)
- Glow effect matching status color
- Typing indicator: Animated ellipsis overlay

#### 3.3 Message Display
**Requirements:**
- Admin messages: Left-aligned, neutral color (#3b82f6)
- Agent responses: Nested below admin message, color-coded
- Timestamp display (relative time)
- Status indicators (pending, processing, completed, failed)

**Message Bubble Design:**
```typescript
interface MessageBubble {
  from: 'admin' | string;  // agent ID
  content: string;
  timestamp: Date;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  agentColor?: string;     // Color-coding for agent
}
```

**Color Mapping:**
```typescript
const AGENT_COLORS: Record<string, string> = {
  nora: '#22c55e',        // Green
  antigravity: '#8b5cf6', // Purple
  scout: '#f59e0b',       // Amber
  // Fallback for unknown agents
  default: '#3b82f6',     // Blue
};
```

#### 3.4 Input System
**Requirements:**
- Multi-line textarea (auto-expand, max 5 lines)
- Send button with loading state
- Keyboard shortcut: Cmd/Ctrl + Enter to send
- Character limit: 2000 characters
- Validation: Non-empty message

---

### Phase 4: Multi-Agent Messaging Backend

#### 4.1 Firestore Schema

**Collection: `agent-group-chats`**
```typescript
interface GroupChat {
  id: string;
  participants: string[];      // Array of agent IDs
  createdBy: 'admin';
  createdAt: Timestamp;
  lastMessageAt: Timestamp;
  status: 'active' | 'closed';
  metadata?: {
    sessionDuration?: number;
    messageCount?: number;
  };
}
```

**Subcollection: `agent-group-chats/{chatId}/messages`**
```typescript
interface GroupChatMessage {
  id: string;
  from: 'admin';
  content: string;
  createdAt: Timestamp;
  broadcastedAt?: Timestamp;
  responses: Record<string, {
    content: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    startedAt?: Timestamp;
    completedAt?: Timestamp;
    error?: string;
  }>;
  allCompleted: boolean;
}
```

**Collection: `agent-commands` (Modified)**
```typescript
interface GroupChatCommand extends ChatMessage {
  type: 'group-chat';
  groupChatId: string;
  messageId: string;
  context: {
    otherAgents: string[];          // Other participants
    previousMessages?: string[];    // Recent message history
  };
}
```

#### 4.2 Message Broadcast Flow

**User Sends Message:**
1. Create/update `agent-group-chats` document
2. Add message to `messages` subcollection
3. Create individual `agent-commands` for each agent:
   ```typescript
   for (const agentId of participants) {
     await addDoc(collection(db, 'agent-commands'), {
       from: 'admin',
       to: agentId,
       type: 'group-chat',
       content: userMessage,
       status: 'pending',
       createdAt: serverTimestamp(),
       groupChatId: chatId,
       messageId: messageId,
       context: {
         otherAgents: participants.filter(id => id !== agentId),
         previousMessages: getRecentMessages(5),
       },
     });
   }
   ```

**Agent Runner Processes:**
1. Detects `type: 'group-chat'` command
2. Generates response with awareness of other agents
3. Updates message document with agent response:
   ```typescript
   await updateDoc(doc(db, `agent-group-chats/${chatId}/messages`, messageId), {
     [`responses.${agentId}.content`]: response,
     [`responses.${agentId}.status`]: 'completed',
     [`responses.${agentId}.completedAt`]: serverTimestamp(),
   });
   ```

#### 4.3 Real-time Listeners

**Modal Component Subscriptions:**
```typescript
// 1. Group chat metadata
const unsubChat = onSnapshot(
  doc(db, 'agent-group-chats', chatId),
  (snap) => setChatMetadata(snap.data())
);

// 2. Messages feed
const unsubMessages = onSnapshot(
  query(
    collection(db, `agent-group-chats/${chatId}/messages`),
    orderBy('createdAt', 'asc')
  ),
  (snap) => {
    const messages = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    setMessages(messages);
  }
);

// 3. Agent presence (for status indicators)
const unsubPresence = presenceService.listen((agents) => {
  setAgentStatuses(agents);
});
```

---

### Phase 5: Return Animation

#### 5.1 Modal Close Handler
**Requirements:**
- User can close modal via:
  - Close button (X)
  - Escape key
  - Clicking outside modal (backdrop)
- Confirmation prompt if agents are still typing
- Graceful cleanup of listeners

**Implementation:**
```typescript
const handleClose = async () => {
  // Check if any agent is currently processing
  const hasActiveResponses = messages.some(msg =>
    Object.values(msg.responses).some(r => r.status === 'processing')
  );

  if (hasActiveResponses) {
    const confirmed = window.confirm(
      'Some agents are still responding. Close anyway?'
    );
    if (!confirmed) return;
  }

  // Mark group chat as closed
  await updateDoc(doc(db, 'agent-group-chats', chatId), {
    status: 'closed',
    closedAt: serverTimestamp(),
  });

  // Trigger return animation
  setIsCollaborating(false);
  // ... animation continues below
};
```

#### 5.2 Reverse Animation
**Requirements:**
- Identical timing to arrival (2s duration)
- Reverse stagger (last to arrive, first to leave)
- Visual feedback: Table returns to idle state
- State cleanup after animation completes

**Animation Sequence:**
```typescript
const animateReturn = async () => {
  // 1. Set transitioning state
  setAgentPositions(prev => {
    const updated = { ...prev };
    Object.keys(updated).forEach(agentId => {
      updated[agentId] = {
        state: 'transitioning',
        currentPosition: updated[agentId].currentPosition,
        targetPosition: getDeskPosition(agentId),
      };
    });
    return updated;
  });

  // 2. Staggered reverse animation
  const agentIds = Object.keys(agentPositions);
  for (let i = agentIds.length - 1; i >= 0; i--) {
    const agentId = agentIds[i];
    await new Promise(resolve => setTimeout(resolve, 150)); // Stagger delay
    
    // Trigger CSS transition via class or style update
    updateAgentPosition(agentId, 'desk');
  }

  // 3. Wait for all animations to complete
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 4. Reset state
  setAgentPositions(initialDeskPositions);
  setIsCollaborating(false);
};
```

---

### Phase 6: Visual Polish

#### 6.1 Walking Animations
**Requirements:**
- Character "walks" during transition
- Arm swing animation
- Head bobbing
- Rotation toward destination
- Speed matches movement duration (2s)

**CSS Implementation:**
```css
.office-character.walking {
  animation: characterWalk 0.6s steps(4) infinite;
}

.office-character.walking .char-arm {
  animation: armSwing 0.6s ease-in-out infinite alternate;
}

@keyframes characterWalk {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-2px) rotate(-2deg); }
  50% { transform: translateY(0) rotate(0deg); }
  75% { transform: translateY(-2px) rotate(2deg); }
}

@keyframes armSwing {
  0% { transform: rotate(-20deg); }
  100% { transform: rotate(20deg); }
}
```

#### 6.2 Stagger Timing
**Requirements:**
- First agent starts immediately on click
- Each subsequent agent delays by 150ms
- Visual wave effect as agents leave desks
- Same timing for return animation (reverse order)

**Implementation:**
```typescript
const startCollaboration = () => {
  const agentIds = allAgents.map(a => a.id);
  
  agentIds.forEach((agentId, index) => {
    setTimeout(() => {
      startAgentTransition(agentId, 'table');
    }, index * 150);
  });

  // Modal appears after first agent starts
  setTimeout(() => {
    setShowGroupChatModal(true);
  }, 300);
};
```

#### 6.3 Sound Effects (Optional Enhancement)
**Requirements:**
- Subtle footstep sounds during movement
- Chair scraping when leaving desk
- Ambient office background (low volume)
- Mute toggle in UI
- Respect browser autoplay policies

**Audio Files Needed:**
- `footsteps.mp3` (2s loop, low volume)
- `chair_scrape.mp3` (0.5s, mono)
- `office_ambience.mp3` (loop, very low volume)

**Implementation:**
```typescript
const playSound = (soundName: string, volume = 0.3) => {
  if (!soundEnabled) return;
  
  const audio = new Audio(`/sounds/${soundName}.mp3`);
  audio.volume = volume;
  audio.play().catch(err => {
    console.warn('Sound playback failed:', err);
  });
};

// Usage
const startAgentTransition = (agentId: string) => {
  playSound('chair_scrape', 0.2);
  setTimeout(() => playSound('footsteps', 0.15), 200);
  // ... transition logic
};
```

#### 6.4 Loading States
**Requirements:**
- Spinner overlay when creating group chat
- Skeleton loaders for message feed
- Button disabled states during send
- Optimistic UI updates (message appears immediately)

**Message Send Flow:**
```typescript
const sendMessage = async (content: string) => {
  // 1. Optimistic update
  const optimisticMessage = {
    id: `temp-${Date.now()}`,
    from: 'admin',
    content,
    createdAt: new Date(),
    responses: {},
    allCompleted: false,
  };
  setMessages(prev => [...prev, optimisticMessage]);

  try {
    // 2. Send to Firestore
    const messageRef = await addDoc(
      collection(db, `agent-group-chats/${chatId}/messages`),
      {
        from: 'admin',
        content,
        createdAt: serverTimestamp(),
        responses: {},
        allCompleted: false,
      }
    );

    // 3. Broadcast to agents
    await broadcastToAgents(messageRef.id, content, participants);

    // 4. Clear input
    setInputText('');
  } catch (error) {
    // 5. Rollback on error
    setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
    setError('Failed to send message. Please try again.');
  }
};
```

#### 6.5 Error Handling
**Requirements:**
- Network failure recovery
- Agent offline handling (show warning)
- Timeout management (45s per agent)
- Retry mechanism for failed responses

**Error States:**
```typescript
interface ErrorState {
  type: 'network' | 'timeout' | 'agent_offline' | 'unknown';
  message: string;
  affectedAgents?: string[];
  retryable: boolean;
}

const handleAgentTimeout = (agentId: string, messageId: string) => {
  updateDoc(doc(db, `agent-group-chats/${chatId}/messages`, messageId), {
    [`responses.${agentId}.status`]: 'failed',
    [`responses.${agentId}.error`]: 'Response timeout (45s)',
  });

  // Show toast notification
  showToast(`${getAgentName(agentId)} is not responding`, 'warning');
};
```

---

## Technical Architecture

### Component Hierarchy
```
VirtualOfficeContent
├── OfficeFloor
│   ├── FloorGrid
│   ├── OfficeWall
│   ├── OfficeDecorations
│   ├── RoundTable (NEW)
│   │   └── onClick → startCollaboration()
│   └── AgentDeskSprite[]
│       └── position: desk | table
│
└── GroupChatModal (NEW - Portal)
    ├── Header
    ├── AgentRow[]
    │   └── AgentAvatar (status, typing indicator)
    ├── MessageFeed
    │   └── MessageBubble[]
    │       ├── AdminMessage
    │       └── AgentResponse[] (nested)
    └── InputArea
        ├── Textarea
        └── SendButton
```

### State Management
```typescript
// Virtual Office Root State
const [isCollaborating, setIsCollaborating] = useState(false);
const [groupChatId, setGroupChatId] = useState<string | null>(null);
const [agentPositions, setAgentPositions] = useState<PositionMap>({});

// Group Chat Modal State
const [messages, setMessages] = useState<GroupChatMessage[]>([]);
const [chatMetadata, setChatMetadata] = useState<GroupChat | null>(null);
const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentPresence>>({});
const [inputText, setInputText] = useState('');
const [sending, setSending] = useState(false);
```

### Service Layer

**New File: `src/api/firebase/groupChat/service.ts`**
```typescript
export const groupChatService = {
  // Create new group chat session
  createSession: async (participantIds: string[]): Promise<string> => {
    const chatRef = await addDoc(collection(db, 'agent-group-chats'), {
      participants: participantIds,
      createdBy: 'admin',
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      status: 'active',
    });
    return chatRef.id;
  },

  // Send message to all agents
  broadcastMessage: async (
    chatId: string,
    content: string,
    participants: string[]
  ): Promise<string> => {
    // Add message document
    const messageRef = await addDoc(
      collection(db, `agent-group-chats/${chatId}/messages`),
      {
        from: 'admin',
        content,
        createdAt: serverTimestamp(),
        responses: {},
        allCompleted: false,
      }
    );

    // Create agent commands
    const commandPromises = participants.map(agentId =>
      addDoc(collection(db, 'agent-commands'), {
        from: 'admin',
        to: agentId,
        type: 'group-chat',
        content,
        status: 'pending',
        createdAt: serverTimestamp(),
        groupChatId: chatId,
        messageId: messageRef.id,
        context: {
          otherAgents: participants.filter(id => id !== agentId),
        },
      })
    );

    await Promise.all(commandPromises);
    return messageRef.id;
  },

  // Close session
  closeSession: async (chatId: string): Promise<void> => {
    await updateDoc(doc(db, 'agent-group-chats', chatId), {
      status: 'closed',
      closedAt: serverTimestamp(),
    });
  },

  // Listen to messages
  listenToMessages: (
    chatId: string,
    callback: (messages: GroupChatMessage[]) => void
  ): Unsubscribe => {
    return onSnapshot(
      query(
        collection(db, `agent-group-chats/${chatId}/messages`),
        orderBy('createdAt', 'asc')
      ),
      (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as GroupChatMessage));
        callback(messages);
      }
    );
  },
};
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
**Day 1-2: Table Element**
- [ ] Create `RoundTable.tsx` component
- [ ] Add SVG graphics with premium styling
- [ ] Implement hover/active states
- [ ] Position in office floor center
- [ ] Add click handler (console.log for now)

**Day 3-4: Position System**
- [ ] Create position calculation utilities
- [ ] Implement table position algorithm
- [ ] Add state management for agent positions
- [ ] Test position calculations with various agent counts

**Day 5: Integration**
- [ ] Wire up table click → position state change
- [ ] Add basic CSS transitions (no stagger yet)
- [ ] Manual testing with 2-6 agents

### Phase 2: Animation Polish (Week 2)
**Day 1-2: Movement System**
- [ ] Implement staggered animation delays
- [ ] Add walking animation CSS
- [ ] Test animation smoothness
- [ ] Add reverse animation logic

**Day 3-4: Visual Polish**
- [ ] Add arm swing, head bob animations
- [ ] Implement table glow animations
- [ ] Add loading states
- [ ] Cross-browser testing (Chrome, Firefox, Safari)

**Day 5: Refinement**
- [ ] Performance optimization (GPU acceleration)
- [ ] Mobile responsive adjustments
- [ ] Accessibility audit (keyboard, screen reader)

### Phase 3: Group Chat Backend (Week 3)
**Day 1-2: Firestore Schema**
- [ ] Create `groupChat/service.ts`
- [ ] Implement `createSession` function
- [ ] Implement `broadcastMessage` function
- [ ] Test with Firestore emulator

**Day 3-4: Agent Runner Integration**
- [ ] Add `group-chat` type handler in agent runner
- [ ] Implement context awareness (other agents)
- [ ] Add response writing to Firestore
- [ ] End-to-end test with live agents

**Day 5: Real-time Listeners**
- [ ] Message feed subscription
- [ ] Presence status integration
- [ ] Typing indicators
- [ ] Error handling and timeouts

### Phase 4: Modal UI (Week 4)
**Day 1-2: Component Structure**
- [ ] Create `GroupChatModal.tsx`
- [ ] Build layout (header, agent row, feed, input)
- [ ] Implement portal rendering
- [ ] Responsive styling

**Day 3-4: Message Display**
- [ ] Admin message bubbles
- [ ] Nested agent responses
- [ ] Color-coded agents
- [ ] Timestamp formatting

**Day 5: Input System**
- [ ] Textarea with auto-expand
- [ ] Send button with loading state
- [ ] Keyboard shortcuts
- [ ] Character validation

### Phase 5: Integration & Testing (Week 5)
**Day 1-2: End-to-End Flow**
- [ ] Wire table click → create session → open modal
- [ ] Message send → broadcast → display responses
- [ ] Modal close → animate return
- [ ] State cleanup

**Day 3-4: Testing**
- [ ] Unit tests for utilities
- [ ] Integration tests for Firestore
- [ ] E2E tests with Playwright/Cypress
- [ ] Manual QA session

**Day 5: Documentation**
- [ ] Code comments and JSDoc
- [ ] User guide for admins
- [ ] Developer README
- [ ] Demo video

### Phase 6: Optional Enhancements (Week 6+)
- [ ] Sound effects implementation
- [ ] Keyboard shortcuts cheat sheet
- [ ] Chat history export
- [ ] Agent voting/polls
- [ ] Screen sharing mockups

---

## Performance Considerations

### Optimization Strategies

#### 1. Animation Performance
- **Use CSS transforms** (not top/left when possible) for GPU acceleration
- **will-change** property for transitioning elements
- **RequestAnimationFrame** for JavaScript animations
- Limit concurrent animations (stagger prevents overload)

```css
.agent-desk-sprite {
  will-change: transform, opacity;
  transform: translateZ(0); /* Force GPU layer */
}
```

#### 2. Firestore Optimization
- **Batch writes** when creating multiple agent commands
- **Index** on `agent-group-chats.status` and `messages.createdAt`
- **Pagination** for message history (load latest 50, infinite scroll)
- **Detach listeners** when modal closes

```typescript
// Batch writes
const batch = writeBatch(db);
participants.forEach(agentId => {
  const commandRef = doc(collection(db, 'agent-commands'));
  batch.set(commandRef, { /* command data */ });
});
await batch.commit();
```

#### 3. React Re-render Optimization
- **useMemo** for computed values (table positions)
- **useCallback** for event handlers
- **React.memo** for AgentDeskSprite if re-renders are frequent
- **Virtualization** for message feed if > 100 messages

```typescript
const tablePositions = useMemo(
  () => calculateAllTablePositions(allAgents.length),
  [allAgents.length]
);

const handleTableClick = useCallback(() => {
  startCollaboration();
}, [allAgents]);
```

#### 4. Network Optimization
- **Optimistic updates** for sent messages
- **Debounce** input events if implementing live typing indicators
- **Retry logic** with exponential backoff for failed requests

---

## Accessibility Requirements

### WCAG 2.1 Level AA Compliance

#### 1. Keyboard Navigation
- **Tab order**: Table → Modal → Agents → Input → Send → Close
- **Focus indicators**: High-contrast outline (2px solid #3b82f6)
- **Shortcuts**:
  - `T` = Focus table (when not in modal)
  - `Esc` = Close modal
  - `Cmd/Ctrl + Enter` = Send message

#### 2. Screen Reader Support
- **ARIA labels** on all interactive elements
- **Live regions** for message updates
- **Role announcements** for agent status changes

```tsx
<button
  aria-label="Start collaboration session with all agents"
  aria-describedby="table-description"
  onClick={handleTableClick}
>
  {/* Table SVG */}
</button>
<div id="table-description" className="sr-only">
  Click to gather all agents around the table for group discussion
</div>

<div
  role="log"
  aria-live="polite"
  aria-atomic="false"
  className="sr-only"
>
  {latestMessage && `${latestMessage.from} says: ${latestMessage.content}`}
</div>
```

#### 3. Visual Accessibility
- **Color contrast**: Minimum 4.5:1 for text
- **Focus states**: Never remove, always enhance
- **Motion reduction**: Respect `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  .agent-desk-sprite {
    transition-duration: 0.01ms !important;
  }
  .office-character.walking {
    animation: none !important;
  }
}
```

#### 4. Alternative Text
- All decorative SVGs: `aria-hidden="true"`
- Agent avatars: `alt="Agent Name emoji"`
- Status indicators: `aria-label="Agent Status: Working"`

---

## Security & Privacy

### Data Access Control
- **Firestore Rules** for `agent-group-chats`:
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /agent-group-chats/{chatId} {
        allow read, write: if request.auth != null && 
                            get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
        
        match /messages/{messageId} {
          allow read, write: if request.auth != null && 
                              get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
        }
      }
    }
  }
  ```

### Input Validation
- **Sanitize user input** before sending to Firestore
- **Rate limiting**: Max 1 message per 2 seconds per user
- **Content length**: Max 2000 characters
- **XSS prevention**: Escape HTML in message display

```typescript
import DOMPurify from 'isomorphic-dompurify';

const sanitizeMessage = (content: string): string => {
  return DOMPurify.sanitize(content, { 
    ALLOWED_TAGS: [], // Plain text only
    ALLOWED_ATTR: [] 
  });
};
```

---

## Testing Strategy

### Unit Tests
**File: `src/components/RoundTable.test.tsx`**
- Table renders with correct SVG elements
- Click handler fires correctly
- Hover states update
- Accessibility attributes present

**File: `src/utils/tablePositions.test.ts`**
- Position calculations accurate for 1-10 agents
- Edge cases: 0 agents, negative values, NaN

### Integration Tests
**File: `src/api/firebase/groupChat/service.test.ts`**
- Create session returns valid ID
- Broadcast creates correct number of commands
- Close session updates status
- Listeners receive real-time updates

### E2E Tests
**File: `cypress/e2e/roundTable.cy.ts`**
```typescript
describe('Round Table Collaboration', () => {
  it('should animate agents to table on click', () => {
    cy.visit('/admin/virtualOffice');
    cy.get('[data-testid="round-table"]').click();
    
    // Wait for animation
    cy.wait(2500);
    
    // Check agent positions
    cy.get('[data-testid="agent-desk-sprite"]').each($el => {
      cy.wrap($el).should('have.class', 'at-table');
    });
    
    // Modal should be visible
    cy.get('[data-testid="group-chat-modal"]').should('be.visible');
  });

  it('should send message to all agents', () => {
    // ... setup ...
    cy.get('[data-testid="chat-input"]').type('Hello team!');
    cy.get('[data-testid="send-button"]').click();
    
    // Message should appear
    cy.contains('Hello team!').should('be.visible');
    
    // Wait for agent responses
    cy.get('[data-testid="agent-response"]', { timeout: 10000 })
      .should('have.length.gte', 1);
  });

  it('should return agents to desks on modal close', () => {
    // ... setup ...
    cy.get('[data-testid="close-modal"]').click();
    
    // Wait for animation
    cy.wait(2500);
    
    // Agents back at desks
    cy.get('[data-testid="agent-desk-sprite"]').each($el => {
      cy.wrap($el).should('have.class', 'at-desk');
    });
  });
});
```

---

## Future Enhancements

### Roadmap (Post-MVP)

#### Q2 2024: Voice Integration
- Text-to-speech for agent responses
- Voice input for user messages
- Multi-lingual support

#### Q3 2024: Advanced Collaboration
- Breakout rooms (subset of agents)
- Agent-to-agent direct messaging
- Voting/polling system
- Task assignment from group chat

#### Q4 2024: Analytics & Insights
- Collaboration session analytics
- Agent response time metrics
- Topic clustering of discussions
- Auto-generated summaries

#### Q1 2025: External Integrations
- Slack/Discord bridging
- Calendar event creation
- Email digest of discussions
- Notion/Linear task creation

---

## Success Metrics

### Key Performance Indicators (KPIs)

#### Technical Metrics
- **Animation smoothness**: Maintain 60 FPS during transitions
- **Time to first response**: < 5s average for first agent reply
- **Message delivery**: 99.9% successful broadcast rate
- **Modal load time**: < 500ms to render

#### User Experience Metrics
- **Engagement**: Average session duration > 5 minutes
- **Frequency**: Used at least 2x per week by admins
- **Completion rate**: > 80% of sessions end with intentional close (not error)
- **Agent participation**: Average 2.5+ responses per agent per message

#### Quality Metrics
- **Error rate**: < 1% of messages fail to send
- **Agent timeout rate**: < 5% of agents timeout per session
- **User satisfaction**: NPS score > 40 (qualitative survey)

---

## Conclusion

The Round Table Collaboration feature represents a significant UX enhancement to the Virtual Office, transforming it from a monitoring dashboard into an interactive workspace. By leveraging existing infrastructure (agent presence, Firestore messaging, CSS animations) and introducing new patterns (group chat, multi-agent coordination), we create a cohesive and delightful experience.

**Key Success Factors:**
1. **Visual Polish**: Premium animations and design elevate the feature
2. **Performance**: Smooth 60 FPS transitions and responsive UI
3. **Reliability**: Robust error handling and real-time synchronization
4. **Extensibility**: Architecture supports future enhancements (voice, voting, breakouts)

**Next Steps:**
- Review and approve this requirements document
- Begin Phase 1 implementation (Table Element)
- Set up development/staging Firestore collections
- Schedule design review session

---

**Document Version**: 1.0  
**Last Updated**: 2024-02-11  
**Author**: Scout (AI Engineer)  
**Status**: Ready for Review  
