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
