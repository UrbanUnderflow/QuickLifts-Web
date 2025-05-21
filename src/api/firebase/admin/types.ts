import { UserCredential } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

export interface DailyPrompt {
  id?: string;
  date: Date;
  text: string;
  exerciseId?: string;
  exerciseName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PageMetaData {
  pageId: string;
  pageTitle?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  lastUpdated: Timestamp;
}

export interface AdminService {
  addVersion: (version: string, changeNotes: string[], isCriticalUpdate: boolean) => Promise<boolean>;
  isAdmin: (email: string) => Promise<boolean>;
  setPageMetaData: (data: PageMetaData) => Promise<boolean>;
  getPageMetaData: (pageId: string) => Promise<PageMetaData | null>;
  createDailyPrompt: (prompt: DailyPrompt) => Promise<boolean>;
  getDailyPrompt: (id: string) => Promise<DailyPrompt | null>;
  getDailyPrompts: (limit?: number) => Promise<DailyPrompt[]>;
} 