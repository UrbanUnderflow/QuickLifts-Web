import { UserCredential } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

export interface DailyPrompt {
  id?: string;
  dateId?: string;
  date: Date;
  text: string;
  exerciseId?: string;
  exerciseName?: string;
  challengeId?: string;
  challengeName?: string;
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

export interface ProgrammingAccess {
  id?: string;
  email: string;
  username?: string;
  userId?: string;
  status: 'requested' | 'active' | 'deactivated';
  name?: string;
  role?: {
    trainer: boolean;
    enthusiast: boolean;
    coach: boolean;
    fitnessInstructor: boolean;
  };
  primaryUse?: string;
  useCases?: {
    oneOnOneCoaching: boolean;
    communityRounds: boolean;
    personalPrograms: boolean;
  };
  clientCount?: string;
  yearsExperience?: string;
  longTermGoal?: string;
  isCertified?: boolean;
  certificationName?: string;
  applyForFoundingCoaches?: boolean;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

export interface BetaApplication {
  id?: string;
  name: string;
  email: string;
  role: {
    trainer: boolean;
    enthusiast: boolean;
    coach: boolean;
    fitnessInstructor: boolean;
  };
  primaryUse: string;
  useCases: {
    oneOnOneCoaching: boolean;
    communityRounds: boolean;
    personalPrograms: boolean;
  };
  clientCount: string;
  yearsExperience: string;
  longTermGoal: string;
  isCertified: boolean;
  certificationName?: string;
  applyForFoundingCoaches: boolean;
  submittedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: Date;
  approvedBy?: string;
  updatedAt?: Date;
}

export interface AdminService {
  addVersion: (version: string, changeNotes: string[], isCriticalUpdate: boolean) => Promise<boolean>;
  isAdmin: (email: string) => Promise<boolean>;
  setPageMetaData: (data: PageMetaData) => Promise<boolean>;
  getPageMetaData: (pageId: string) => Promise<PageMetaData | null>;
  createDailyPrompt: (prompt: DailyPrompt) => Promise<boolean>;
  getDailyPrompt: (id: string) => Promise<DailyPrompt | null>;
  getDailyPrompts: (limit?: number) => Promise<DailyPrompt[]>;
  deleteDailyPrompt: (id: string) => Promise<boolean>;
  // Programming Access methods
  createProgrammingAccessRequest: (request: Omit<ProgrammingAccess, 'id' | 'createdAt' | 'updatedAt'>) => Promise<boolean>;
  getProgrammingAccessRequests: () => Promise<ProgrammingAccess[]>;
  updateProgrammingAccessStatus: (id: string, status: 'active' | 'deactivated', approvedBy?: string) => Promise<boolean>;
  checkProgrammingAccess: (email: string) => Promise<ProgrammingAccess | null>;
  deleteProgrammingAccessRequest: (id: string) => Promise<boolean>;
  // Beta Application methods
  getBetaApplications: () => Promise<BetaApplication[]>;
  updateBetaApplicationStatus: (id: string, status: 'approved' | 'rejected', approvedBy?: string) => Promise<boolean>;
  deleteBetaApplication: (id: string) => Promise<boolean>;
} 