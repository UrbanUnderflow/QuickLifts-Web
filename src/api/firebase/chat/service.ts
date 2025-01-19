import { GroupMessage } from "./types";

// services/ChatService.ts
export class ChatService {
    static instance: ChatService;
    private db: any; // Firebase database reference
  
    private constructor() {
      // Initialize Firebase db reference
    }
  
    static getInstance(): ChatService {
      if (!ChatService.instance) {
        ChatService.instance = new ChatService();
      }
      return ChatService.instance;
    }
  
    async fetchChallengeMessages(collectionId: string): Promise<GroupMessage[]> {
      try {
        const messagesRef = this.db
          .collection("sweatlist-collection")
          .doc(collectionId)
          .collection("messages")
          .orderBy("timestamp");
  
        const snapshot = await messagesRef.get();
        
        return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            sender: data.sender,
            content: data.content,
            checkinId: data.checkinId || "",
            timestamp: new Date(data.timestamp * 1000),
            readBy: this.parseReadBy(data.readBy || {}),
            mediaURL: data.mediaURL || "",
            mediaType: data.mediaType || "none",
            gymName: data.gymName || ""
          };
        });
      } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }
    }
  
    private parseReadBy(readByData: any): { [key: string]: Date } {
      const readBy: { [key: string]: Date } = {};
      Object.entries(readByData).forEach(([userId, timestamp]) => {
        readBy[userId] = new Date((timestamp as number) * 1000);
      });
      return readBy;
    }
  }