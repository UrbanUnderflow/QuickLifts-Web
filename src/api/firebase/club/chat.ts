import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../config';
import {
  GroupMessage,
  MessageMediaType,
  firestoreToMessage,
  messageToFirestore,
} from '../chat/types';

class ClubChatService {
  private static instance: ClubChatService;

  private constructor() {}

  static getInstance(): ClubChatService {
    if (!ClubChatService.instance) {
      ClubChatService.instance = new ClubChatService();
    }

    return ClubChatService.instance;
  }

  private getMessagesRef(clubId: string) {
    return collection(doc(db, 'round-chat', clubId), 'messages');
  }

  subscribeToMessages(
    clubId: string,
    callback: (messages: GroupMessage[]) => void
  ): () => void {
    const messagesRef = this.getMessagesRef(clubId);
    const clubMessagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));

    return onSnapshot(clubMessagesQuery, (snapshot) => {
      callback(snapshot.docs.map((messageDoc) => firestoreToMessage(messageDoc.id, messageDoc.data())));
    });
  }

  async sendMessage(
    clubId: string,
    message: Omit<GroupMessage, 'id'>
  ): Promise<GroupMessage | null> {
    try {
      const messagesRef = this.getMessagesRef(clubId);
      const messageRef = await addDoc(messagesRef, messageToFirestore(message));

      return {
        ...message,
        id: messageRef.id,
      };
    } catch (error) {
      console.error('[ClubChatService] Failed to send message:', error);
      return null;
    }
  }

  async uploadMedia(
    clubId: string,
    file: File,
    mediaType: MessageMediaType
  ): Promise<string | null> {
    try {
      const folder =
        mediaType === MessageMediaType.Image
          ? 'images'
          : mediaType === MessageMediaType.Video
            ? 'videos'
            : 'audio';
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
      const mediaRef = ref(storage, `club-chat/${clubId}/${folder}/${fileName}`);

      await uploadBytes(mediaRef, file);
      return await getDownloadURL(mediaRef);
    } catch (error) {
      console.error('[ClubChatService] Failed to upload media:', error);
      return null;
    }
  }
}

export const clubChatService = ClubChatService.getInstance();
