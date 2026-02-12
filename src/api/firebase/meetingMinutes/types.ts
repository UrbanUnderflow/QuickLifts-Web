import { Timestamp } from 'firebase/firestore';

export interface MeetingMinutes {
    id?: string;
    chatId: string;
    createdAt: Timestamp | Date;
    duration: string;
    participants: string[];
    messageCount: number;

    // AI-generated sections
    executiveSummary: string;
    valueInsights?: InsightItem[];
    strategicDecisions?: string[];
    nextActions?: ActionItem[];
    highlights?: HighlightItem[];
    risksOrOpenQuestions?: string[];
}

export interface InsightItem {
    title: string;
    takeaway: string;
    impact: string;
}

export interface HighlightItem {
    speaker: string;
    summary: string;
}

export interface ActionItem {
    task: string;
    owner: string;
    due?: string;
}
