import { ShortUser } from '../api/firebase/user';

export interface GroupMessage {
    id: string; // Unique identifier for the message
    sender: ShortUser; // Details about the sender
    content: string; // Text content of the message
    checkinId?: string | null; // Optional check-in association
    timestamp: Date; // Time when the message was sent
    readBy: Record<string, Date>; // Record of users who read the message
    mediaURL?: string | null; // URL for image or video
    mediaType: MessageMediaType; // Type of media (none, image, video)
  }
  
  export enum MessageMediaType {
    None = 'none',
    Image = 'image',
    Video = 'video',
  }
  
  export enum QuickMessage {
    Encourage = '💪 Keep it up!',
    Congrats = '🎉 Great work!',
    Support = 'You\'ve got this!',
    Thanks = 'Thank you!',
  }