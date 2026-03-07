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
  recipientFcmTokens?: string[] | null;
  visibility?: string | null;
  visibleToUserId?: string | null;
  questionnaireData?: {
    surveyId: string;
    surveyTitle: string;
    surveyDescription?: string;
    ownerUserId: string;
    pageSlug?: string;
    instanceId?: string;
    completedBy?: { [userId: string]: boolean };
  } | null;
}

export enum QuickMessage {
  Encourage = '💪 Keep it up!',
  Congrats = '🎉 Great work!',
  Support = 'You\'ve got this!',
  Thanks = 'Thank you!',
}

// Update serialization function to handle input without 'id'
export const messageToFirestore = (message: Omit<GroupMessage, 'id'>) => {
  // Convert sender class instance to a plain object so Firestore can serialize it
  const senderData =
    typeof (message.sender as any)?.toDictionary === 'function'
      ? (message.sender as any).toDictionary()
      : message.sender;

  // Convert readBy Date values to plain objects Firestore can handle
  const readByData = Object.entries(message.readBy || {}).reduce<Record<string, any>>(
    (acc, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    {}
  );

  return {
    sender: senderData,
    content: message.content,
    checkinId: message.checkinId || null,
    timestamp: message.timestamp,
    readBy: readByData,
    mediaURL: message.mediaURL || null,
    mediaType: message.mediaType,
    gymName: message.gymName || null,
    recipientFcmTokens: message.recipientFcmTokens || null,
    visibility: message.visibility || 'public',
    visibleToUserId: message.visibleToUserId || null,
    questionnaireData: message.questionnaireData || null,
  };
};

const toDate = (value: any): Date => {
  if (!value) {
    return new Date(0);
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  if (typeof value === 'number') {
    return value > 1_000_000_000_000 ? new Date(value) : new Date(value * 1000);
  }

  return new Date(value);
};

// Deserialization function
export const firestoreToMessage = (id: string, data: any): GroupMessage => ({
  id,
  sender: data.sender,
  content: data.content,
  checkinId: data.checkinId || null,
  timestamp: toDate(data.timestamp),
  readBy: Object.entries(data.readBy || {}).reduce<Record<string, Date>>((accumulator, [key, value]) => {
    accumulator[key] = toDate(value);
    return accumulator;
  }, {}),
  mediaURL: data.mediaURL || null,
  mediaType: data.mediaType || MessageMediaType.None,
  gymName: data.gymName || null,
  recipientFcmTokens: Array.isArray(data.recipientFcmTokens) ? data.recipientFcmTokens : null,
  visibility: data.visibility || 'public',
  visibleToUserId: data.visibleToUserId || null,
  questionnaireData: data.questionnaireData || null,
});
