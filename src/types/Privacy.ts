export interface AthletePrivacySettings {
  id: string;
  athleteUserId: string;
  coachId?: string;
  shareConversationsWithCoach: boolean;
  shareSentimentWithCoach: boolean;
  consentGivenAt?: Date;
  lastUpdatedAt: Date;
  createdAt: Date;
}

export interface PrivacyConsentRequest {
  athleteUserId: string;
  coachId: string;
  coachName: string;
  shareConversations: boolean;
  shareSentiment: boolean;
}
