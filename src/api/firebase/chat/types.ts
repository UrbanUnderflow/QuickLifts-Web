import {ShortUser} from '../user/types';

export enum MessageMediaType {
    None = 'none',
    Image = 'image',
    Video = 'video',
    Audio = 'audio'
  }
  
  export interface GroupMessage {
    id: string;
    sender: ShortUser;
    content: string;
    checkinId?: string | null;
    timestamp: number;  // Unix timestamp in seconds
    readBy: { [userId: string]: number };  // userId to timestamp mapping
    mediaURL?: string | null;
    mediaType: MessageMediaType;
    gymName?: string | null;
  
    // Optional helper method to convert to Firebase format
    toFirestore(): {
      id: string;
      sender: any;
      content: string;
      checkinId: string | null;
      timestamp: number;
      readBy: { [key: string]: number };
      mediaURL: string | null;
      mediaType: string;
      gymName: string | null;
    };
  }
  
  // Implementation of toFirestore method
  export const messageToFirestore = (message: GroupMessage) => {
    const dict: any = {
      id: message.id,
      sender: message.sender,  // Assuming ShortUser can be stored directly
      content: message.content,
      checkinId: message.checkinId || null,
      timestamp: message.timestamp,
      readBy: message.readBy,
      gymName: message.gymName || null
    };
  
    if (message.mediaURL && message.mediaURL.length > 0) {
      dict.mediaURL = message.mediaURL;
      dict.mediaType = message.mediaType;
    } else {
      dict.mediaURL = "";
      dict.mediaType = MessageMediaType.None;
    }
  
    return dict;
  };