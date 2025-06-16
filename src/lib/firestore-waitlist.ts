import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../api/firebase/config';

export interface WaitlistEntry {
  id?: string;
  email: string;
  name?: string;
  userType: 'athlete' | 'coach';
  source: string;
  utmCampaign?: string;
  createdAt: Timestamp;
  brevoSyncStatus: 'pending' | 'success' | 'failed';
  brevoSyncError?: string;
  emailSentStatus: 'pending' | 'success' | 'failed';
  emailSentError?: string;
}

export class FirestoreWaitlistService {
  private static readonly COLLECTION_NAME = 'pulse-check-waitlist';

  /**
   * Add a new entry to the waitlist collection
   */
  static async addWaitlistEntry(data: {
    email: string;
    name?: string;
    userType: 'athlete' | 'coach';
    source?: string;
    utmCampaign?: string;
    brevoSyncStatus?: 'pending' | 'success' | 'failed';
    brevoSyncError?: string;
    emailSentStatus?: 'pending' | 'success' | 'failed';
    emailSentError?: string;
  }): Promise<string> {
    try {
      const waitlistEntry: Omit<WaitlistEntry, 'id'> = {
        email: data.email.toLowerCase().trim(),
        name: data.name?.trim() || '',
        userType: data.userType,
        source: data.source || 'pulse-check-landing',
        utmCampaign: data.utmCampaign || 'pulse-check-landing',
        createdAt: serverTimestamp() as Timestamp,
        brevoSyncStatus: data.brevoSyncStatus || 'pending',
        brevoSyncError: data.brevoSyncError,
        emailSentStatus: data.emailSentStatus || 'pending',
        emailSentError: data.emailSentError,
      };

      const docRef = await addDoc(
        collection(db, this.COLLECTION_NAME),
        waitlistEntry
      );

      console.log('[Firestore Waitlist] Entry added successfully:', {
        id: docRef.id,
        email: data.email,
        userType: data.userType,
        timestamp: new Date().toISOString()
      });

      return docRef.id;
    } catch (error) {
      console.error('[Firestore Waitlist] Error adding entry:', error);
      throw new Error(`Failed to save waitlist entry to Firestore: ${error}`);
    }
  }

  /**
   * Update the Brevo sync status for an entry
   */
  static async updateBrevoSyncStatus(
    docId: string, 
    status: 'success' | 'failed', 
    error?: string
  ): Promise<void> {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      
      await updateDoc(doc(db, this.COLLECTION_NAME, docId), {
        brevoSyncStatus: status,
        brevoSyncError: error || null,
        brevoSyncedAt: serverTimestamp()
      });

      console.log('[Firestore Waitlist] Brevo sync status updated:', {
        docId,
        status,
        error: error || 'none'
      });
    } catch (updateError) {
      console.error('[Firestore Waitlist] Error updating Brevo sync status:', updateError);
      // Don't throw here as this is a secondary operation
    }
  }

  /**
   * Update the email sent status for an entry
   */
  static async updateEmailSentStatus(
    docId: string, 
    status: 'success' | 'failed', 
    error?: string
  ): Promise<void> {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      
      await updateDoc(doc(db, this.COLLECTION_NAME, docId), {
        emailSentStatus: status,
        emailSentError: error || null,
        emailSentAt: serverTimestamp()
      });

      console.log('[Firestore Waitlist] Email sent status updated:', {
        docId,
        status,
        error: error || 'none'
      });
    } catch (updateError) {
      console.error('[Firestore Waitlist] Error updating email sent status:', updateError);
      // Don't throw here as this is a secondary operation
    }
  }

  /**
   * Check if an email already exists in the waitlist
   */
  static async emailExists(email: string): Promise<boolean> {
    try {
      const { query, where, getDocs } = await import('firebase/firestore');
      
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('email', '==', email.toLowerCase().trim())
      );
      
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('[Firestore Waitlist] Error checking email existence:', error);
      // Return false to allow the process to continue
      return false;
    }
  }

  /**
   * Get waitlist statistics
   */
  static async getWaitlistStats(): Promise<{
    total: number;
    athletes: number;
    coaches: number;
    brevoSynced: number;
    emailsSent: number;
  }> {
    try {
      const { getDocs } = await import('firebase/firestore');
      
      const querySnapshot = await getDocs(collection(db, this.COLLECTION_NAME));
      
      let total = 0;
      let athletes = 0;
      let coaches = 0;
      let brevoSynced = 0;
      let emailsSent = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data() as WaitlistEntry;
        total++;
        
        if (data.userType === 'athlete') athletes++;
        if (data.userType === 'coach') coaches++;
        if (data.brevoSyncStatus === 'success') brevoSynced++;
        if (data.emailSentStatus === 'success') emailsSent++;
      });

      return {
        total,
        athletes,
        coaches,
        brevoSynced,
        emailsSent
      };
    } catch (error) {
      console.error('[Firestore Waitlist] Error getting stats:', error);
      return {
        total: 0,
        athletes: 0,
        coaches: 0,
        brevoSynced: 0,
        emailsSent: 0
      };
    }
  }
} 