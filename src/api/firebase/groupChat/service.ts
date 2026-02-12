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

    // 2. Initialize response placeholders
    const responses: Record<string, AgentResponse> = {};
    participants.forEach((agentId) => {
      responses[agentId] = {
        content: '',
        status: 'pending',
      };
    });

    // 3. Create agent commands in batch
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
