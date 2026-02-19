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
  getDoc,
} from 'firebase/firestore';
import { db } from '../config';
import type {
  GroupChat,
  GroupChatMessage,
  GroupChatCommand,
  AgentResponse,
  GroupChatTurnState,
} from './types';

const TURN_COORDINATOR_ID = 'nora';
const GROUP_CHAT_TURN_ORDER = ['nora', 'solara', 'sage', 'scout', 'antigravity'];
const GROUP_CHAT_TURN_SLA_MS = 90_000;
const AGENT_NAME_ALIASES: Record<string, string[]> = {
  nora: ['nora'],
  solara: ['solara'],
  sage: ['sage'],
  scout: ['scout'],
  antigravity: ['antigravity', 'antigrav'],
};

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const normalized = String(value).trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ordered.push(normalized);
  }
  return ordered;
}

function sortByTurnPriority(participants: string[]): string[] {
  const participantSet = new Set(uniqueStrings(participants));
  const prioritized = GROUP_CHAT_TURN_ORDER.filter((id) => participantSet.has(id));
  const remaining = Array.from(participantSet)
    .filter((id) => !prioritized.includes(id))
    .sort((a, b) => a.localeCompare(b));
  return uniqueStrings([...prioritized, ...remaining]);
}

function parseMentionedAgents(content: string, participants: string[]): string[] {
  const allowed = new Set(uniqueStrings(participants));
  const mentionSet = new Set<string>();
  if (!content) return [];

  const lowerContent = String(content).toLowerCase();
  const mentionTokens = (lowerContent.match(/@([a-z][a-z0-9_-]*)/g) || []).map((token) => token.slice(1));

  const aliases = Object.entries(AGENT_NAME_ALIASES);
  for (const token of mentionTokens) {
    for (const [id, aliasList] of aliases) {
      if (!allowed.has(id)) continue;
      if (aliasList.includes(token)) {
        mentionSet.add(id);
      }
    }
  }

  // Fallback: support @Nora-style mentions even when token parsing misses punctuation.
  for (const [id, aliasList] of aliases) {
    if (!allowed.has(id)) continue;
    for (const alias of aliasList) {
      if (lowerContent.includes(`@${alias}`)) {
        mentionSet.add(id);
      }
    }
  }

  return Array.from(mentionSet);
}

function buildTurnStateForMessage(
  participants: string[],
  content: string,
): GroupChatTurnState {
  const orderedParticipants = sortByTurnPriority(participants);
  const mentioned = parseMentionedAgents(content || '', orderedParticipants);
  const turnOrder = uniqueStrings([
    ...mentioned,
    ...orderedParticipants.filter((id) => !mentioned.includes(id)),
  ]);

  return {
    participants: orderedParticipants,
    turnOrder,
    coordinator: TURN_COORDINATOR_ID,
    turnIndex: 0,
    currentTurnAgent: turnOrder[0] || '',
    turnSlaMs: GROUP_CHAT_TURN_SLA_MS,
    currentTurnStartedAt: serverTimestamp() as Timestamp,
  };
}

function buildTurnContextForAgent(
  participantTurnState: GroupChatTurnState,
  agentId: string,
) {
  const safeTurnIndex = participantTurnState.turnOrder.indexOf(agentId);
  return {
    participants: participantTurnState.participants,
    turnOrder: participantTurnState.turnOrder,
    coordinator: participantTurnState.coordinator,
    turnIndex: safeTurnIndex >= 0 ? safeTurnIndex : 0,
    currentTurnAgent: participantTurnState.currentTurnAgent,
    turnSlaMs: participantTurnState.turnSlaMs,
    ...(participantTurnState.currentTurnStartedAt
      ? { currentTurnStartedAt: participantTurnState.currentTurnStartedAt }
      : {}),
  };
}

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
    participants: string[],
    from: string = 'admin'
  ): Promise<string> {
    const normalizedParticipants = sortByTurnPriority(participants);
    const turnState = buildTurnStateForMessage(normalizedParticipants, content);

    // 1. Add message to chat
    const messageData: Omit<GroupChatMessage, 'id'> = {
      from,
      content,
      createdAt: serverTimestamp() as Timestamp,
      broadcastedAt: serverTimestamp() as Timestamp,
      responses: {},
      turnState,
      allCompleted: false,
    };

    const messageRef = await addDoc(
      collection(db, `agent-group-chats/${chatId}/messages`),
      messageData
    );

    // 2. Initialize response placeholders
    const responses: Record<string, AgentResponse> = {};
    normalizedParticipants.forEach((agentId) => {
      responses[agentId] = {
        content: '',
        status: 'pending',
      };
    });

    // 3. Create agent commands in batch
    const batch = writeBatch(db);

    normalizedParticipants.forEach((agentId) => {
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
          otherAgents: normalizedParticipants.filter(id => id !== agentId),
          mentionedAgents: parseMentionedAgents(content, normalizedParticipants),
          turnState: buildTurnContextForAgent(turnState, agentId),
          turnSlaMs: GROUP_CHAT_TURN_SLA_MS,
          followUpDepth: 0,
        },
      };
      batch.set(commandRef, commandData);
    });

    // Update message with response placeholders
    batch.update(messageRef, {
      responses: responses,
    });

    await batch.commit();

    // 4. Update chat metadata
    await updateDoc(doc(db, 'agent-group-chats', chatId), {
      lastMessageAt: serverTimestamp(),
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
   * Get chat metadata
   */
  async getChatMetadata(chatId: string): Promise<GroupChat | null> {
    const chatDoc = await getDoc(doc(db, 'agent-group-chats', chatId));
    if (!chatDoc.exists()) return null;

    return {
      id: chatDoc.id,
      ...(chatDoc.data() as Omit<GroupChat, 'id'>),
    };
  }
}

// Export singleton instance
export const groupChatService = new GroupChatService();
