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
    topicsDiscussed: TopicItem[];
    keyInsights: string[];
    decisions: string[];
    openQuestions: string[];
    actionItems: ActionItem[];
}

export interface TopicItem {
    title: string;
    summary: string;
}

export interface ActionItem {
    task: string;
    owner: string;
}
