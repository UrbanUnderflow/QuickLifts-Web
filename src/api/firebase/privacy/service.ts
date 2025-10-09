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
   * Privacy settings are stored in the coachAthletes record
   */
  async updatePrivacyConsent(consentRequest: PrivacyConsentRequest): Promise<void> {
    try {
      console.log(`[PrivacyService] Updating privacy consent for athlete: ${consentRequest.athleteUserId}`);
      
      // Update the coachAthletes record with privacy settings (single source of truth)
      const coachAthletesRef = collection(db, 'coachAthletes');
      const connectionQuery = query(
        coachAthletesRef,
        where('coachId', '==', consentRequest.coachId),
        where('athleteUserId', '==', consentRequest.athleteUserId)
      );
      const connectionSnapshot = await getDocs(connectionQuery);
      
      if (!connectionSnapshot.empty) {
        const connectionDoc = connectionSnapshot.docs[0];
        await updateDoc(doc(db, 'coachAthletes', connectionDoc.id), {
          shareConversations: consentRequest.shareConversations,
          shareSentiment: consentRequest.shareSentiment,
          updatedAt: serverTimestamp()
        });
        console.log(`[PrivacyService] Updated privacy settings in coachAthletes record`);
      } else {
        console.error(`[PrivacyService] No connection found between athlete ${consentRequest.athleteUserId} and coach ${consentRequest.coachId}`);
        throw new Error('Connection not found');
      }
      
      console.log(`[PrivacyService] Privacy consent updated successfully`);
    } catch (error) {
      console.error('[PrivacyService] Error updating privacy consent:', error);
      throw error;
    }
  }

  /**
   * Check if coach can access athlete's conversations
   * Uses coachAthletes record as single source of truth
   */
  async canCoachAccessConversations(athleteUserId: string, coachId: string): Promise<boolean> {
    try {
      const settings = await this.getPrivacyFromCoachAthlete(athleteUserId, coachId);
      return settings?.shareConversations ?? true; // Default to true if not found
    } catch (error) {
      console.error('[PrivacyService] Error checking conversation access:', error);
      return true; // Default to true on error
    }
  }

  /**
   * Check if coach can access athlete's sentiment data
   * Uses coachAthletes record as single source of truth
   */
  async canCoachAccessSentiment(athleteUserId: string, coachId: string): Promise<boolean> {
    try {
      const settings = await this.getPrivacyFromCoachAthlete(athleteUserId, coachId);
      return settings?.shareSentiment ?? true; // Default to true if not found
    } catch (error) {
      console.error('[PrivacyService] Error checking sentiment access:', error);
      return true; // Default to true on error
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

  /**
   * Get privacy settings from coachAthletes record (primary source)
   */
  async getPrivacyFromCoachAthlete(athleteUserId: string, coachId: string): Promise<{shareConversations: boolean, shareSentiment: boolean} | null> {
    try {
      const coachAthletesRef = collection(db, 'coachAthletes');
      const connectionQuery = query(
        coachAthletesRef,
        where('coachId', '==', coachId),
        where('athleteUserId', '==', athleteUserId)
      );
      const connectionSnapshot = await getDocs(connectionQuery);
      
      if (!connectionSnapshot.empty) {
        const data = connectionSnapshot.docs[0].data();
        return {
          shareConversations: data.shareConversations ?? true, // Default to true
          shareSentiment: data.shareSentiment ?? true // Default to true
        };
      }
      
      return null;
    } catch (error) {
      console.error('[PrivacyService] Error fetching privacy from coachAthletes:', error);
      return null;
    }
  }
}

export const privacyService = new PrivacyService();
