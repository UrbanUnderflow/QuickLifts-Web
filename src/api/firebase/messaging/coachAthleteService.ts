import { 
  collection, 
  doc, 
  addDoc, 
  getDoc,
  getDocs, 
  increment,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config';
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
  coachName: string;
  athleteName: string;
  lastMessage: string;
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
    coachName: data.coachName,
    athleteName: data.athleteName,
    lastMessage: data.lastMessage || '',
    lastMessageTimestamp: convertFirestoreTimestamp(data.lastMessageTimestamp),
    lastMessageSenderId: data.lastMessageSenderId || '',
    unreadCount: data.unreadCount || {},
    activeBooking,
    activeBookings,
    createdAt: convertFirestoreTimestamp(data.createdAt),
    updatedAt: convertFirestoreTimestamp(data.updatedAt)
  };
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
    athleteName: string
  ): Promise<CoachAthleteConversation> {
    try {
      // Check if conversation already exists
      const conversationsRef = collection(db, this.conversationsCollection);
      const existingQuery = query(
        conversationsRef,
        where('coachId', '==', coachId),
        where('athleteId', '==', athleteId)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        return mapConversationDoc(existingSnapshot.docs[0]);
      }

      // Create new conversation
      const newConversation = {
        coachId,
        athleteId,
        coachName,
        athleteName,
        lastMessage: '',
        lastMessageTimestamp: serverTimestamp(),
        lastMessageSenderId: '',
        unreadCount: { [coachId]: 0, [athleteId]: 0 },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(conversationsRef, newConversation);
      
      return {
        id: docRef.id,
        coachId,
        athleteId,
        coachName,
        athleteName,
        lastMessage: '',
        lastMessageTimestamp: new Date(),
        lastMessageSenderId: '',
        unreadCount: { [coachId]: 0, [athleteId]: 0 },
        createdAt: new Date(),
        updatedAt: new Date()
      };
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
      const batch = writeBatch(db);
      const conversationRef = doc(db, this.conversationsCollection, conversationId);
      const conversationSnap = await getDoc(conversationRef);
      const conversation = conversationSnap.data();
      const recipientId =
        senderType === 'coach' ? conversation?.athleteId : conversation?.coachId;
      
      // Add message
      const messagesRef = collection(db, this.messagesCollection);
      const messageDoc = doc(messagesRef);
      
      const messageData = {
        conversationId,
        senderId,
        senderType,
        content,
        timestamp: serverTimestamp(),
        readBy: { [senderId]: serverTimestamp() }, // Sender has read it
        messageType,
        mediaUrl: mediaUrl || null
      };
      
      batch.set(messageDoc, messageData);
      
      // Update conversation
      const conversationUpdate: Record<string, any> = {
        lastMessage: content,
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
        content,
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
  async getConversationsForUser(userId: string, userType: 'coach' | 'athlete'): Promise<CoachAthleteConversation[]> {
    try {
      const conversationsRef = collection(db, this.conversationsCollection);
      const field = userType === 'coach' ? 'coachId' : 'athleteId';
      const conversationsQuery = query(
        conversationsRef,
        where(field, '==', userId),
        orderBy('lastMessageTimestamp', 'desc')
      );
      
      const snapshot = await getDocs(conversationsQuery);
      
      return snapshot.docs.map(mapConversationDoc);
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
      
      // Query conversations where user is a coach
      const coachQuery = query(
        conversationsRef,
        where('coachId', '==', userId)
      );
      
      // Query conversations where user is an athlete
      const athleteQuery = query(
        conversationsRef,
        where('athleteId', '==', userId)
      );
      
      const [coachSnapshot, athleteSnapshot] = await Promise.all([
        getDocs(coachQuery),
        getDocs(athleteQuery)
      ]);
      
      const conversations: CoachAthleteConversation[] = [];
      
      // Map coach conversations
      coachSnapshot.docs.forEach(doc => {
        conversations.push(mapConversationDoc(doc));
      });
      
      // Map athlete conversations
      athleteSnapshot.docs.forEach(doc => {
        conversations.push(mapConversationDoc(doc));
      });
      
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
      const batch = writeBatch(db);
      
      // Get unread messages
      const messagesRef = collection(db, this.messagesCollection);
      const unreadQuery = query(
        messagesRef,
        where('conversationId', '==', conversationId),
        where(`readBy.${userId}`, '==', null)
      );
      
      const snapshot = await getDocs(unreadQuery);
      
      // Mark messages as read
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          [`readBy.${userId}`]: serverTimestamp()
        });
      });
      
      // Reset unread count for this user
      const conversationRef = doc(db, this.conversationsCollection, conversationId);
      batch.update(conversationRef, {
        [`unreadCount.${userId}`]: 0
      });
      
      await batch.commit();
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
    callback: (conversations: CoachAthleteConversation[]) => void
  ): () => void {
    const conversationsRef = collection(db, this.conversationsCollection);
    const field = userType === 'coach' ? 'coachId' : 'athleteId';
    const conversationsQuery = query(
      conversationsRef,
      where(field, '==', userId),
      orderBy('lastMessageTimestamp', 'desc')
    );
    
    return onSnapshot(conversationsQuery, (snapshot) => {
      const conversations = snapshot.docs.map(mapConversationDoc);
      
      callback(conversations);
    });
  }
}

export const coachAthleteMessagingService = new CoachAthleteMessagingService();
