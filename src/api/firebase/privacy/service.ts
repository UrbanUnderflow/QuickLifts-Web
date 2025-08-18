import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from '../config';
import { AthletePrivacySettings, PrivacyConsentRequest } from '../../../types/Privacy';

class PrivacyService {
  private privacyCollection = 'athlete-privacy-settings';

  /**
   * Get privacy settings for an athlete
   */
  async getAthletePrivacySettings(athleteUserId: string): Promise<AthletePrivacySettings | null> {
    try {
      console.log(`[PrivacyService] Fetching privacy settings for athlete: ${athleteUserId}`);
      
      const privacyRef = doc(db, this.privacyCollection, athleteUserId);
      const privacyDoc = await getDoc(privacyRef);
      
      if (!privacyDoc.exists()) {
        console.log(`[PrivacyService] No privacy settings found for athlete: ${athleteUserId}`);
        return null;
      }
      
      const data = privacyDoc.data();
      return {
        id: privacyDoc.id,
        athleteUserId: data.athleteUserId,
        coachId: data.coachId,
        shareConversationsWithCoach: data.shareConversationsWithCoach || false,
        shareSentimentWithCoach: data.shareSentimentWithCoach !== false, // Default to true
        consentGivenAt: data.consentGivenAt?.toDate(),
        lastUpdatedAt: data.lastUpdatedAt?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date()
      };
    } catch (error) {
      console.error('[PrivacyService] Error fetching privacy settings:', error);
      return null;
    }
  }

  /**
   * Create default privacy settings for a new athlete
   */
  async createDefaultPrivacySettings(athleteUserId: string): Promise<AthletePrivacySettings> {
    try {
      console.log(`[PrivacyService] Creating default privacy settings for athlete: ${athleteUserId}`);
      
      const defaultSettings: Omit<AthletePrivacySettings, 'id'> = {
        athleteUserId,
        shareConversationsWithCoach: false, // Private by default
        shareSentimentWithCoach: true, // Allow sentiment sharing by default
        lastUpdatedAt: new Date(),
        createdAt: new Date()
      };
      
      const privacyRef = doc(db, this.privacyCollection, athleteUserId);
      await setDoc(privacyRef, {
        ...defaultSettings,
        lastUpdatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
      return {
        id: athleteUserId,
        ...defaultSettings
      };
    } catch (error) {
      console.error('[PrivacyService] Error creating default privacy settings:', error);
      throw error;
    }
  }

  /**
   * Update privacy consent when connecting to a coach
   */
  async updatePrivacyConsent(consentRequest: PrivacyConsentRequest): Promise<void> {
    try {
      console.log(`[PrivacyService] Updating privacy consent for athlete: ${consentRequest.athleteUserId}`);
      
      const privacyRef = doc(db, this.privacyCollection, consentRequest.athleteUserId);
      
      // Check if settings exist, create if not
      const existingDoc = await getDoc(privacyRef);
      
      const updateData = {
        athleteUserId: consentRequest.athleteUserId,
        coachId: consentRequest.coachId,
        shareConversationsWithCoach: consentRequest.shareConversations,
        shareSentimentWithCoach: consentRequest.shareSentiment,
        consentGivenAt: serverTimestamp(),
        lastUpdatedAt: serverTimestamp()
      };
      
      if (!existingDoc.exists()) {
        // Create new document
        await setDoc(privacyRef, {
          ...updateData,
          createdAt: serverTimestamp()
        });
      } else {
        // Update existing document
        await updateDoc(privacyRef, updateData);
      }
      
      console.log(`[PrivacyService] Privacy consent updated successfully`);
    } catch (error) {
      console.error('[PrivacyService] Error updating privacy consent:', error);
      throw error;
    }
  }

  /**
   * Check if coach can access athlete's conversations
   */
  async canCoachAccessConversations(athleteUserId: string, coachId: string): Promise<boolean> {
    try {
      const privacySettings = await this.getAthletePrivacySettings(athleteUserId);
      
      if (!privacySettings) {
        // No settings = default to private
        return false;
      }
      
      // Check if this is the correct coach and conversations are shared
      return privacySettings.coachId === coachId && privacySettings.shareConversationsWithCoach;
    } catch (error) {
      console.error('[PrivacyService] Error checking conversation access:', error);
      return false;
    }
  }

  /**
   * Check if coach can access athlete's sentiment data
   */
  async canCoachAccessSentiment(athleteUserId: string, coachId: string): Promise<boolean> {
    try {
      const privacySettings = await this.getAthletePrivacySettings(athleteUserId);
      
      if (!privacySettings) {
        // No settings = default to allow sentiment (but not conversations)
        return true;
      }
      
      // Check if this is the correct coach and sentiment is shared
      return privacySettings.coachId === coachId && privacySettings.shareSentimentWithCoach;
    } catch (error) {
      console.error('[PrivacyService] Error checking sentiment access:', error);
      return false;
    }
  }

  /**
   * Get all athletes who have given consent to a specific coach
   */
  async getAthletesWithConsentForCoach(coachId: string): Promise<AthletePrivacySettings[]> {
    try {
      console.log(`[PrivacyService] Fetching athletes with consent for coach: ${coachId}`);
      
      const privacyRef = collection(db, this.privacyCollection);
      const consentQuery = query(privacyRef, where('coachId', '==', coachId));
      const consentSnapshot = await getDocs(consentQuery);
      
      const athletesWithConsent: AthletePrivacySettings[] = [];
      
      consentSnapshot.docs.forEach(docSnapshot => {
        const data = docSnapshot.data();
        athletesWithConsent.push({
          id: docSnapshot.id,
          athleteUserId: data.athleteUserId,
          coachId: data.coachId,
          shareConversationsWithCoach: data.shareConversationsWithCoach || false,
          shareSentimentWithCoach: data.shareSentimentWithCoach !== false,
          consentGivenAt: data.consentGivenAt?.toDate(),
          lastUpdatedAt: data.lastUpdatedAt?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date()
        });
      });
      
      return athletesWithConsent;
    } catch (error) {
      console.error('[PrivacyService] Error fetching athletes with consent:', error);
      return [];
    }
  }
}

export const privacyService = new PrivacyService();
