import {
  GroupMessage,
  messageToFirestore,
  firestoreToMessage,
  MessageMediaType,
} from "./types";
import { db, storage } from "../config";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
  startAfter,
  limit,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export class ChatService {
  private static instance: ChatService;
  private messagesPerPage = 50;

  private constructor() {}

  static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  private validateCollectionId(collectionId: string): boolean {
    if (
      !collectionId ||
      typeof collectionId !== "string" ||
      collectionId.trim() === "" ||
      collectionId.length > 1500 ||
      /[\/.]/.test(collectionId)
    ) {
      console.error(`Invalid collection ID: ${collectionId}`);
      return false;
    }
    return true;
  }

  private getMessagesRef(collectionId: string) {
    if (!this.validateCollectionId(collectionId)) {
      return null;
    }
    const parentDocRef = doc(db, "sweatlist-collection", collectionId);
    return collection(parentDocRef, "messages");
  }

  async fetchChallengeMessages(
    collectionId: string,
    lastVisible?: QueryDocumentSnapshot<DocumentData>
  ): Promise<GroupMessage[]> {
    try {
      const messagesRef = this.getMessagesRef(collectionId);
      if (!messagesRef) {
        return [];
      }

      let q = query(
        messagesRef,
        orderBy("timestamp", "desc"),
        limit(this.messagesPerPage)
      );

      if (lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => this.parseMessageDocument(doc)).reverse();
    } catch (error) {
      console.error("Error fetching messages:", error);
      return [];
    }
  }

  subscribeToMessages(
    collectionId: string,
    callback: (messages: GroupMessage[]) => void
  ): () => void {
    try {
      const messagesRef = this.getMessagesRef(collectionId);
      if (!messagesRef) {
        return () => {};
      }

      const q = query(messagesRef, orderBy("timestamp", "asc"));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map((doc) => this.parseMessageDocument(doc));
        callback(messages);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error subscribing to messages:", error);
      return () => {};
    }
  }

  async sendMessage(
    collectionId: string,
    message: Omit<GroupMessage, "id">
  ): Promise<GroupMessage | null> {
    try {
      const messagesRef = this.getMessagesRef(collectionId);
      if (!messagesRef) {
        return null;
      }

      const docRef = await addDoc(messagesRef, messageToFirestore(message));

      return {
        ...message,
        id: docRef.id,
      };
    } catch (error) {
      console.error("Error sending message:", error);
      return null;
    }
  }

  private parseMessageDocument(
    doc: QueryDocumentSnapshot<DocumentData>
  ): GroupMessage {
    return firestoreToMessage(doc.id, doc.data());
  }

  async uploadMedia(file: File): Promise<string | null> {
    try {
      const storageRef = ref(storage, `chat-media/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error("Error uploading media:", error);
      return null;
    }
  }

  async markMessagesAsRead(
    collectionId: string,
    userId: string,
    messageIds: string[]
  ): Promise<void> {
    try {
      if (!this.validateCollectionId(collectionId)) {
        return;
      }

      const parentDocRef = doc(db, "sweatlist-collection", collectionId);

      await Promise.all(
        messageIds.map(async (messageId) => {
          const messageRef = doc(parentDocRef, "messages", messageId);
          await updateDoc(messageRef, {
            [`readBy.${userId}`]: Timestamp.now(),
          });
        })
      );
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  }
}
