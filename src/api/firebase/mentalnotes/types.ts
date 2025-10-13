export enum MentalNoteStatus {
  Active = 'active',
  Improving = 'improving',
  Monitoring = 'monitoring',
  Resolved = 'resolved',
  Declined = 'declined',
}

export enum MentalNoteSeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export enum MentalNoteCategory {
  Sleep = 'sleep',
  Nutrition = 'nutrition',
  Stress = 'stress',
  Emotions = 'emotions',
  Focus = 'focus',
  Confidence = 'confidence',
  Recovery = 'recovery',
  Other = 'other',
}

export interface MentalNote {
  id: string;
  userId: string;
  title: string;
  content?: string;
  category?: MentalNoteCategory;
  severity?: MentalNoteSeverity;
  status: MentalNoteStatus;
  relatedMessageIds?: string[];
  actionItems?: string[];
  createdAt?: number; // seconds unix time
  lastDiscussed?: number; // seconds unix time
}

export interface MentalNoteStats {
  totalNotes: number;
  activeNotes: number;
  resolvedNotes: number;
  improvingNotes: number;
  monitoringNotes: number;
  highPriorityNotes: number;
}

export const noteToFirestore = (note: MentalNote) => {
  const { id, ...rest } = note;
  return rest;
};

export const noteFromFirestore = (id: string, data: any): MentalNote => ({
  id,
  userId: data.userId,
  title: data.title,
  content: data.content,
  category: data.category,
  severity: data.severity,
  status: data.status,
  relatedMessageIds: data.relatedMessageIds || [],
  actionItems: data.actionItems || [],
  createdAt: typeof data.createdAt === 'number' ? data.createdAt : data.createdAt?.seconds,
  lastDiscussed: typeof data.lastDiscussed === 'number' ? data.lastDiscussed : data.lastDiscussed?.seconds,
});


