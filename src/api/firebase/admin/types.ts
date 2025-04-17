import { UserCredential } from 'firebase/auth';

export interface AdminService {
  addVersion: (version: string, changeNotes: string[], isCriticalUpdate: boolean) => Promise<boolean>;
  isAdmin: (email: string) => Promise<boolean>;
} 