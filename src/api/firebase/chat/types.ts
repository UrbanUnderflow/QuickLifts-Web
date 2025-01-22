// types.ts
import { ShortUser } from '../user/types';

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
    timestamp: Date;
    readBy: Record<string, Date>;
    mediaURL?: string | null;
    mediaType: MessageMediaType;
    gymName?: string | null;
}

export enum QuickMessage {
    Encourage = '💪 Keep it up!',
    Congrats = '🎉 Great work!',
    Support = 'You\'ve got this!',
    Thanks = 'Thank you!',
}

// Update serialization function to handle input without 'id'
export const messageToFirestore = (message: Omit<GroupMessage, 'id'>) => {
  return {
    sender: message.sender,
    content: message.content,
    checkinId: message.checkinId || null,
    timestamp: message.timestamp,
    readBy: message.readBy,
    mediaURL: message.mediaURL || null,
    mediaType: message.mediaType,
    gymName: message.gymName || null
  };
};

// Deserialization function
export const firestoreToMessage = (id: string, data: any): GroupMessage => ({
  id,
  sender: data.sender,
  content: data.content,
  checkinId: data.checkinId || null,
  timestamp: data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp),
  readBy: data.readBy || {},
  mediaURL: data.mediaURL || null,
  mediaType: data.mediaType || MessageMediaType.None,
  gymName: data.gymName || null
});