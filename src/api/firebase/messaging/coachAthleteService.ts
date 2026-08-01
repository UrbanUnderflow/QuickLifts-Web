import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  increment,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  runTransaction,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../config';
import { convertFirestoreTimestamp } from '../../../utils/formatDate';

export interface CoachAthleteMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'coach' | 'athlete';
  content: string;
  timestamp: Date;
  readBy: { [userId: string]: Date };
  messageType: 'text' | 'image' | 'file';
  mediaUrl?: string;
}

export interface CoachServiceBooking {
  id?: string;
  orderId?: string;
  serviceId?: string;
  serviceTitle?: string;
  serviceName?: string;
  title?: string;
  coachId?: string;
  athleteId?: string;
  teamId?: string;
  organizationId?: string;
  athleteName?: string;
  coachName?: string;
  scheduledAt?: Date;
  scheduledAtMs?: number;
  scheduledDate?: string;
  scheduledTime?: string;
  priceCents?: number;
  price?: number;
  currency?: string;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CoachAthleteConversation {
  id: string;
  coachId: string;
  athleteId: string;
  teamId?: string;
  organizationId?: string;
  participantIds?: string[];
  coachName: string;
  athleteName: string;
  lastMessage: string;
  lastMessageId?: string;
  lastMessageTimestamp: Date;
  lastMessageSenderId: string;
  unreadCount: { [userId: string]: number };
  activeBooking?: CoachServiceBooking;
  activeBookings?: CoachServiceBooking[];
  createdAt: Date;
  updatedAt: Date;
}

const optionalDate = (value: any): Date | undefined => {
  if (value == null) return undefined;
  if (typeof value === 'string' && Number.isNaN(Number(value))) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return convertFirestoreTimestamp(value);
};

const normalizeBooking = (booking: any): CoachServiceBooking | undefined => {
  if (!booking || typeof booking !== 'object') return undefined;
  return {
    ...booking,
    scheduledAt: optionalDate(booking.scheduledAt),
    createdAt: optionalDate(booking.createdAt),
    updatedAt: optionalDate(booking.updatedAt),
  };
};

const mapConversationDoc = (docSnap: any): CoachAthleteConversation => {
  const data = docSnap.data();
  const activeBooking = normalizeBooking(data.activeBooking);
  const activeBookings = Array.isArray(data.activeBookings)
    ? data.activeBookings.map(normalizeBooking).filter(Boolean) as CoachServiceBooking[]
    : undefined;

  return {
    id: docSnap.id,
    coachId: data.coachId,
    athleteId: data.athleteId,
    teamId: data.teamId,
    organizationId: data.organizationId,
    participantIds: Array.isArray(data.participantIds) ? data.participantIds : undefined,
    coachName: data.coachName,
    athleteName: data.athleteName,
    lastMessage: data.lastMessage || '',
    lastMessageId: data.lastMessageId || undefined,
    lastMessageTimestamp: convertFirestoreTimestamp(data.lastMessageTimestamp),
    lastMessageSenderId: data.lastMessageSenderId || '',
    unreadCount: data.unreadCount || {},
    activeBooking,
    activeBookings,
    createdAt: convertFirestoreTimestamp(data.createdAt),
    updatedAt: convertFirestoreTimestamp(data.updatedAt)
  };
};

const scopedConversationId = (
  organizationId: string,
  teamId: string,
  coachId: string,
  athleteId: string
): string => {
  const scope = [organizationId, teamId, coachId, athleteId];
  if (scope.some((value) => !/^[A-Za-z0-9_-]{1,256}$/.test(value))) {
    throw new Error('This conversation scope contains an invalid identifier.');
  }
  return `pcv2_${scope.join('~')}`;
};

class CoachAthleteMessagingService {
  private conversationsCollection = 'coach-athlete-conversations';
  private messagesCollection = 'coach-athlete-messages';

  /**
   * Get or create a conversation between a coach and athlete
   */
  async getOrCreateConversation(
    coachId: string, 
    athleteId: string, 
    coachName: string, 
    athleteName: string,
    scope?: { organizationId: string; teamId: string }
  ): Promise<CoachAthleteConversation> {
    try {
      const organizationId = String(scope?.organizationId || '').trim();
      const teamId = String(scope?.teamId || '').trim();
      const hasTeamScope = Boolean(organizationId && teamId);
      const signedInUserId = auth.currentUser?.uid || '';
      if (!signedInUserId || (signedInUserId !== coachId && signedInUserId !== athleteId)) {
        throw new Error('Sign in as a conversation participant to open messages.');
      }
      if (!hasTeamScope) {
        throw new Error('An active team is required to start a conversation.');
      }

      // Check if conversation already exists
      const conversationsRef = collection(db, this.conversationsCollection);
      const existingQuery = query(
        conversationsRef,
        where('coachId', '==', coachId),
        where('athleteId', '==', athleteId),
        where('teamId', '==', teamId),
        where('organizationId', '==', organizationId)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      
      const existingDocument = existingSnapshot.docs.find((document) => {
        const data = document.data() || {};
        const participantIds = Array.isArray(data.participantIds)
          ? [...new Set(
              data.participantIds
                .map((value: unknown) => String(value || '').trim())
                .filter(Boolean)
            )].sort()
          : [];
        const expectedParticipantIds = [coachId, athleteId].sort();
        return data.organizationId === organizationId
          && data.teamId === teamId
          && participantIds.length === 2
          && participantIds.every(
            (value: string, index: number) => value === expectedParticipantIds[index]
          );
      });
      if (existingDocument) {
        return mapConversationDoc(existingDocument);
      }

      const newConversation = {
        coachId,
        athleteId,
        organizationId,
        teamId,
        participantIds: [coachId, athleteId],
        coachName,
        athleteName,
        lastMessage: '',
        lastMessageId: '',
        lastMessageTimestamp: serverTimestamp(),
        lastMessageSenderId: '',
        unreadCount: { [coachId]: 0, [athleteId]: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const conversationId = scopedConversationId(
        organizationId,
        teamId,
        coachId,
        athleteId
      );
      const conversationRef = doc(
        db,
        this.conversationsCollection,
        conversationId
      );
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(conversationRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          const participantIds = Array.isArray(data.participantIds)
            ? [...new Set(data.participantIds.map(String))].sort()
            : [];
          if (
            data.coachId !== coachId
            || data.athleteId !== athleteId
            || data.organizationId !== organizationId
            || data.teamId !== teamId
            || participantIds.join(',') !== [coachId, athleteId].sort().join(',')
          ) {
            throw new Error('The conversation identifier is already in use.');
          }
          return;
        }
        transaction.set(conversationRef, newConversation);
      });

      const resolvedConversation = await getDoc(conversationRef);
      if (!resolvedConversation.exists()) {
        throw new Error('The conversation could not be prepared.');
      }
      return mapConversationDoc(resolvedConversation);
    } catch (error) {
      console.error('[CoachAthleteMessagingService] Error getting/creating conversation:', error);
      throw error;
    }
  }

  /**
   * Send a message in a coach-athlete conversation
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    senderType: 'coach' | 'athlete',
    content: string,
    messageType: 'text' | 'image' | 'file' = 'text',
    mediaUrl?: string
  ): Promise<CoachAthleteMessage> {
    try {
      const cleanContent = content.trim();
      if (!cleanContent) {
        throw new Error('Write a message before sending.');
      }
      if (cleanContent.length > 4_000) {
        throw new Error('Keep messages under 4,000 characters.');
      }
      if (auth.currentUser?.uid !== senderId) {
        throw new Error('The signed-in user must match the message sender.');
      }

      const batch = writeBatch(db);
      const conversationRef = doc(db, this.conversationsCollection, conversationId);
      const conversationSnap = await getDoc(conversationRef);
      if (!conversationSnap.exists()) {
        throw new Error('This conversation is unavailable.');
      }
      const conversation = conversationSnap.data();
      const expectedSenderId = senderType === 'coach'
        ? conversation.coachId
        : conversation.athleteId;
      if (expectedSenderId !== senderId) {
        throw new Error('The sender role does not match this conversation.');
      }
      const recipientId =
        senderType === 'coach' ? conversation?.athleteId : conversation?.coachId;
      if (!recipientId || recipientId === senderId) {
        throw new Error('This conversation is missing its recipient.');
      }
      
      // Add message
      const messagesRef = collection(db, this.messagesCollection);
      const messageDoc = doc(messagesRef);
      
      const messageData = {
        conversationId,
        senderId,
        senderType,
        content: cleanContent,
        timestamp: serverTimestamp(),
        readBy: { [senderId]: serverTimestamp() }, // Sender has read it
        messageType,
        ...(mediaUrl ? { mediaUrl } : {})
      };
      
      batch.set(messageDoc, messageData);
      
      // Update conversation
      const conversationUpdate: Record<string, any> = {
        lastMessage: cleanContent,
        lastMessageId: messageDoc.id,
        lastMessageTimestamp: serverTimestamp(),
        lastMessageSenderId: senderId,
        updatedAt: serverTimestamp(),
      };

      if (recipientId) {
        conversationUpdate[`unreadCount.${recipientId}`] = increment(1);
      }
      
      batch.update(conversationRef, conversationUpdate);
      
      await batch.commit();
      
      return {
        id: messageDoc.id,
        conversationId,
        senderId,
        senderType,
        content: cleanContent,
        timestamp: new Date(),
        readBy: { [senderId]: new Date() },
        messageType,
        mediaUrl
      };
    } catch (error) {
      console.error('[CoachAthleteMessagingService] Error sending message:', error);
      throw error;
    }
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string): Promise<CoachAthleteMessage[]> {
    try {
      const messagesRef = collection(db, this.messagesCollection);
      const messagesQuery = query(
        messagesRef,
        where('conversationId', '==', conversationId),
        orderBy('timestamp', 'asc')
      );
      
      const snapshot = await getDocs(messagesQuery);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          conversationId: data.conversationId,
          senderId: data.senderId,
          senderType: data.senderType,
          content: data.content,
          timestamp: convertFirestoreTimestamp(data.timestamp),
          readBy: Object.keys(data.readBy || {}).reduce((acc, userId) => {
            acc[userId] = convertFirestoreTimestamp(data.readBy[userId]);
            return acc;
          }, {} as { [userId: string]: Date }),
          messageType: data.messageType || 'text',
          mediaUrl: data.mediaUrl
        };
      });
    } catch (error) {
      console.error('[CoachAthleteMessagingService] Error getting messages:', error);
      throw error;
    }
  }

  /**
   * Get conversations for a user (coach or athlete)
   */
  async getConversationsForUser(
    userId: string,
    userType: 'coach' | 'athlete',
    scope?: {
      organizationId: string;
      teamId: string;
      athleteIds?: string[];
    }
  ): Promise<CoachAthleteConversation[]> {
    try {
      const conversationsRef = collection(db, this.conversationsCollection);
      const organizationId = String(scope?.organizationId || '').trim();
      const teamId = String(scope?.teamId || '').trim();
      if (userType === 'coach' && (!organizationId || !teamId)) {
        throw new Error('Choose an active team before loading coach messages.');
      }
      if (userType === 'athlete') {
        const snapshot = await getDocs(query(
          conversationsRef,
          where('athleteId', '==', userId),
          orderBy('lastMessageTimestamp', 'desc')
        ));
        return snapshot.docs.map(mapConversationDoc);
      }

      const athleteIds = [...new Set(
        (scope?.athleteIds || []).map(String).map((value) => value.trim())
          .filter(Boolean)
      )];
      const chunks: string[][] = [];
      for (let index = 0; index < athleteIds.length; index += 10) {
        chunks.push(athleteIds.slice(index, index + 10));
      }
      const coachQueries = (chunks.length > 0 ? chunks : [null]).map(
        (athleteChunk) => query(
          conversationsRef,
          where('coachId', '==', userId),
          where('teamId', '==', teamId),
          where('organizationId', '==', organizationId),
          ...(athleteChunk
            ? [where('athleteId', 'in', athleteChunk)]
            : []),
          orderBy('lastMessageTimestamp', 'desc')
        )
      );
      const snapshots = await Promise.all(
        coachQueries.map((coachQuery) => getDocs(coachQuery))
      );
      return snapshots.flatMap((snapshot) => snapshot.docs.map(mapConversationDoc));
    } catch (error) {
      console.error('[CoachAthleteMessagingService] Error getting conversations:', error);
      throw error;
    }
  }

  /**
   * Get all conversations for a user (both as coach and athlete)
   */
  async getUserConversations(userId: string): Promise<CoachAthleteConversation[]> {
    try {
      const conversationsRef = collection(db, this.conversationsCollection);
      const athleteQuery = query(
        conversationsRef,
        where('athleteId', '==', userId),
        orderBy('lastMessageTimestamp', 'desc')
      );
      const membershipsQuery = query(
        collection(db, 'pulsecheck-team-memberships'),
        where('userId', '==', userId)
      );

      const [athleteSnapshot, membershipsSnapshot] = await Promise.all([
        getDocs(athleteQuery),
        getDocs(membershipsQuery)
      ]);

      const staffScopes = membershipsSnapshot.docs.flatMap((membership) => {
        const data = membership.data() || {};
        const teamId = String(data.teamId || '').trim();
        const organizationId = String(data.organizationId || '').trim();
        const rosterVisibilityScope = String(
          data.rosterVisibilityScope || 'team'
        ).trim();
        const allowedAthleteIds = Array.isArray(data.allowedAthleteIds)
          ? data.allowedAthleteIds
              .map((value: unknown) => String(value || '').trim())
              .filter(Boolean)
          : [];
        const isActive = (data.status == null || data.status === 'active')
          && data.revokedAt == null;
        return isActive
          && data.role !== 'athlete'
          && teamId
          && organizationId
          ? [{
              teamId,
              organizationId,
              rosterVisibilityScope,
              allowedAthleteIds,
            }]
          : [];
      });
      const coachQueries = staffScopes.flatMap((scope) => {
        const baseFilters = [
          where('coachId', '==', userId),
          where('teamId', '==', scope.teamId),
          where('organizationId', '==', scope.organizationId),
        ];
        if (scope.rosterVisibilityScope !== 'assigned') {
          return [query(
            conversationsRef,
            ...baseFilters,
            orderBy('lastMessageTimestamp', 'desc')
          )];
        }
        const chunks: string[][] = [];
        for (
          let index = 0;
          index < scope.allowedAthleteIds.length;
          index += 10
        ) {
          chunks.push(scope.allowedAthleteIds.slice(index, index + 10));
        }
        return chunks.map((athleteIds) => query(
          conversationsRef,
          ...baseFilters,
          where('athleteId', 'in', athleteIds),
          orderBy('lastMessageTimestamp', 'desc')
        ));
      });
      const coachSnapshots = await Promise.all(
        coachQueries.map((coachQuery) => getDocs(coachQuery))
      );

      const conversationsById = new Map<string, CoachAthleteConversation>();
      athleteSnapshot.docs.forEach((document) => {
        conversationsById.set(document.id, mapConversationDoc(document));
      });
      coachSnapshots.forEach((snapshot) => {
        snapshot.docs.forEach((document) => {
          conversationsById.set(document.id, mapConversationDoc(document));
        });
      });
      const conversations = [...conversationsById.values()];
      // Sort by most recent
      conversations.sort((a, b) => b.lastMessageTimestamp.getTime() - a.lastMessageTimestamp.getTime());
      
      return conversations;
    } catch (error) {
      console.error('[CoachAthleteMessagingService] Error getting user conversations:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      if (auth.currentUser?.uid !== userId) {
        throw new Error('The signed-in user must match the message reader.');
      }
      
      // Firestore equality checks do not match a missing nested map key. Load
      // the scoped thread and identify unread messages locally so messages that
      // only contain the sender's read receipt are handled correctly.
      const messagesRef = collection(db, this.messagesCollection);
      const unreadQuery = query(
        messagesRef,
        where('conversationId', '==', conversationId)
      );
      
      const snapshot = await getDocs(unreadQuery);
      const unreadDocuments = snapshot.docs.filter((messageDocument) => {
        const data = messageDocument.data() || {};
        const readBy = data.readBy && typeof data.readBy === 'object'
          ? data.readBy
          : {};
        return data.senderId !== userId && readBy[userId] == null;
      });
      
      for (let index = 0; index < unreadDocuments.length; index += 400) {
        const batch = writeBatch(db);
        unreadDocuments.slice(index, index + 400).forEach((messageDocument) => {
          batch.update(messageDocument.ref, {
            [`readBy.${userId}`]: serverTimestamp()
          });
        });
        await batch.commit();
      }
      
      // Reset unread count for this user
      const conversationRef = doc(db, this.conversationsCollection, conversationId);
      const conversationBatch = writeBatch(db);
      conversationBatch.update(conversationRef, {
        [`unreadCount.${userId}`]: 0
      });
      
      await conversationBatch.commit();
    } catch (error) {
      console.error('[CoachAthleteMessagingService] Error marking messages as read:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time messages for a conversation
   */
  subscribeToMessages(
    conversationId: string, 
    callback: (messages: CoachAthleteMessage[]) => void
  ): () => void {
    const messagesRef = collection(db, this.messagesCollection);
    const messagesQuery = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      orderBy('timestamp', 'asc')
    );
    
    return onSnapshot(messagesQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          conversationId: data.conversationId,
          senderId: data.senderId,
          senderType: data.senderType,
          content: data.content,
          timestamp: convertFirestoreTimestamp(data.timestamp),
          readBy: Object.keys(data.readBy || {}).reduce((acc, userId) => {
            acc[userId] = convertFirestoreTimestamp(data.readBy[userId]);
            return acc;
          }, {} as { [userId: string]: Date }),
          messageType: data.messageType || 'text',
          mediaUrl: data.mediaUrl
        };
      });
      
      callback(messages);
    });
  }

  /**
   * Subscribe to real-time conversations for a user
   */
  subscribeToConversations(
    userId: string, 
    userType: 'coach' | 'athlete',
    callback: (conversations: CoachAthleteConversation[]) => void,
    scope?: { organizationId: string; teamId: string }
  ): () => void {
    const conversationsRef = collection(db, this.conversationsCollection);
    const organizationId = String(scope?.organizationId || '').trim();
    const teamId = String(scope?.teamId || '').trim();
    if (userType === 'coach' && (!organizationId || !teamId)) {
      throw new Error('Choose an active team before loading coach messages.');
    }
    const conversationsQuery = userType === 'coach'
      ? query(
          conversationsRef,
          where('coachId', '==', userId),
          where('teamId', '==', teamId),
          where('organizationId', '==', organizationId),
          orderBy('lastMessageTimestamp', 'desc')
        )
      : query(
          conversationsRef,
          where('athleteId', '==', userId),
          orderBy('lastMessageTimestamp', 'desc')
        );
    
    return onSnapshot(conversationsQuery, (snapshot) => {
      const conversations = snapshot.docs.map(mapConversationDoc);
      
      callback(conversations);
    });
  }
}

export const coachAthleteMessagingService = new CoachAthleteMessagingService();
