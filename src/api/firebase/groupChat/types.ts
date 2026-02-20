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
  standupMeta?: {
    type: 'morning' | 'evening';
    scheduledAt: Timestamp | Date;
    moderator: string;
    maxDurationMinutes: number;
  };
}

export interface AgentResponse {
  content: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'timed-out';
  startedAt?: Timestamp | Date;
  completedAt?: Timestamp | Date;
  timedOutAt?: Timestamp | Date;
  timedOutReason?: string;
  error?: string;
}

export interface GroupChatMessage {
  id?: string;
  from: string;
  content: string;
  createdAt: Timestamp | Date;
  broadcastedAt?: Timestamp | Date;
  responses: Record<string, AgentResponse>;
  allCompleted: boolean;
  turnState?: GroupChatTurnState;
}

export interface GroupChatTurnState {
  participants: string[];
  turnOrder: string[];
  coordinator: string;
  turnIndex: number;
  currentTurnAgent: string;
  turnSlaMs: number;
  currentTurnStartedAt?: Timestamp | Date;
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
    mentionedAgents?: string[];
    turnState?: GroupChatTurnState;
    turnSlaMs?: number;
    followUpDepth?: number;
    previousMessages?: Array<{
      from: string;
      content: string;
    }>;
  };
}
