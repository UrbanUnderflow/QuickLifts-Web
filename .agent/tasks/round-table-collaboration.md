# Round Table Collaboration Feature

## Overview
Add a visual "round table" to the Virtual Office where all agents can gather for group collaboration sessions. When clicked, agents animate from their desks to the table, and a group chat modal opens for multi-agent discussions.

## User Flow

1. **Idle state**: Round table sits in center of Virtual Office, agents at their desks
2. **User clicks table**: 
   - Table glows/pulses to indicate activation
   - All agents animate from their desk positions → table (2s smooth transition)
   - Agents arrange in a circle around the table
3. **Group chat opens**:
   - Modal appears showing all agents seated at table
   - Group chat interface with all agents visible
   - User can send messages that broadcast to ALL agents
   - Each agent responds individually (shown as separate bubbles)
4. **User closes modal**:
   - Agents animate back to their desks (reverse transition)
   - Table returns to idle state

## Technical Implementation

### 1. Virtual Office Layout Changes

**File**: `src/pages/admin/virtualOffice.tsx`

- Add round table SVG/component in center of office grid
- Position: center of the viewport, between agent desks
- Style: Premium wood table with subtle glow effect
- Hover state: Pulse animation + tooltip "Start collaboration session"

### 2. Agent Position States

Track agent positions in state:
```typescript
type AgentPosition = 'desk' | 'table';
const [agentPositions, setAgentPositions] = useState<Record<string, AgentPosition>>({});
const [isCollaborating, setIsCollaborating] = useState(false);
```

### 3. Animation System

**CSS transitions** for smooth movement:
- Each agent card gets `position: absolute` with `transition: all 2s ease-in-out`
- Calculate desk positions (current layout)
- Calculate table positions (circle around center table)
- Toggle between position sets when collaboration starts/ends

**Table positions** (circular arrangement):
```typescript
const getTablePosition = (agentIndex: number, totalAgents: number) => {
  const angle = (agentIndex / totalAgents) * 2 * Math.PI;
  const radius = 200; // px from table center
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
  };
};
```

### 4. Group Chat Modal

**New component**: `GroupChatModal.tsx`

**Features**:
- Shows all agents in a horizontal row at top (avatars + status)
- Single input field at bottom
- Messages broadcast to ALL agents simultaneously
- Responses appear as individual agent bubbles (color-coded by agent)
- Real-time updates as agents respond

**Firestore structure**:
```typescript
// New collection: agent-group-chats
{
  id: string;
  participants: string[]; // agent IDs
  createdBy: 'admin';
  createdAt: Timestamp;
  status: 'active' | 'closed';
}

// Messages subcollection
{
  from: string; // 'admin' or agent ID
  content: string;
  createdAt: Timestamp;
  responses?: { [agentId: string]: string }; // agent responses
}
```

### 5. Multi-Agent Messaging

**When user sends a message**:
1. Create a group chat document (if first message)
2. Add message to `messages` subcollection
3. Create individual `agent-commands` for EACH agent with `type: 'group-chat'`
4. Each agent runner picks up their command and responds
5. Responses update the original message doc

**Agent runner changes**:
- Detect `type: 'group-chat'` messages
- Respond with awareness of other agents in the conversation
- Update the group chat message with their response

### 6. Visual Polish

- **Table glow** when active
- **Agent avatars** show subtle "walking" animation during transition
- **Smooth easing** for position changes
- **Stagger animations** (agents arrive one by one, not all at once)
- **Sound effects** (optional): footsteps, chair scraping, ambient office sounds

## Implementation Steps

### Phase 1: Layout & Table Element
- [ ] Add round table SVG to Virtual Office center
- [ ] Style table with hover/active states
- [ ] Add click handler

### Phase 2: Agent Movement
- [ ] Refactor agent cards to use absolute positioning
- [ ] Calculate desk positions (preserve current layout)
- [ ] Calculate table positions (circular arrangement)
- [ ] Implement position transition on table click
- [ ] Add stagger delay for sequential arrival

### Phase 3: Group Chat Modal
- [ ] Create `GroupChatModal.tsx` component
- [ ] Build UI: agent row, message list, input
- [ ] Implement Firestore listeners for group chat
- [ ] Handle message sending (broadcast to all agents)

### Phase 4: Multi-Agent Messaging
- [ ] Update agent runner to handle `group-chat` type
- [ ] Implement response collection in Firestore
- [ ] Display agent responses in real-time
- [ ] Add agent awareness (agents can reference each other)

### Phase 5: Return Animation
- [ ] Implement modal close handler
- [ ] Trigger reverse animation (table → desk)
- [ ] Reset collaboration state

### Phase 6: Polish
- [ ] Add walking animations
- [ ] Stagger return animations
- [ ] Add sound effects
- [ ] Add loading states
- [ ] Error handling

## Design Considerations

**Table design**: 
- Rich wood texture
- Subtle glow when active
- Large enough to feel like a "gathering space"
- Centered in viewport

**Agent arrangement at table**:
- Circular, evenly spaced
- Facing inward toward table
- Avatars slightly larger when at table
- Name labels visible

**Group chat UX**:
- Clear indication of who's "speaking"
- Show typing indicators when agents are processing
- Scroll to latest message
- Persist chat history (can review past collaboration sessions)

## Future Enhancements

- **Voice mode**: Agents "speak" their responses with text-to-speech
- **Screen sharing**: Agents can share code snippets or diagrams
- **Voting**: Quick polls for decision-making
- **Breakout rooms**: Split agents into smaller groups
- **Meeting summaries**: Auto-generate summary when session ends
