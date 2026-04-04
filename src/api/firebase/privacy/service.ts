import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp
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
   * Privacy settings are stored on athlete privacy documents, scoped per coach when available.
   */
  async updatePrivacyConsent(consentRequest: PrivacyConsentRequest): Promise<void> {
    try {
      console.log(`[PrivacyService] Updating privacy consent for athlete: ${consentRequest.athleteUserId}`);

      const coachPrivacyRef = doc(
        db,
        this.privacyCollection,
        consentRequest.athleteUserId,
        'coaches',
        consentRequest.coachId
      );
      const athletePrivacyRef = doc(db, this.privacyCollection, consentRequest.athleteUserId);

      await Promise.all([
        setDoc(
          coachPrivacyRef,
          {
            athleteUserId: consentRequest.athleteUserId,
            coachId: consentRequest.coachId,
            coachName: consentRequest.coachName,
            shareConversations: consentRequest.shareConversations,
            shareSentiment: consentRequest.shareSentiment,
            consentGivenAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        ),
        setDoc(
          athletePrivacyRef,
          {
            athleteUserId: consentRequest.athleteUserId,
            coachId: consentRequest.coachId,
            shareConversationsWithCoach: consentRequest.shareConversations,
            shareSentimentWithCoach: consentRequest.shareSentiment,
            consentGivenAt: serverTimestamp(),
            lastUpdatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        ),
      ]);
      
      console.log(`[PrivacyService] Privacy consent updated successfully`);
    } catch (error) {
      console.error('[PrivacyService] Error updating privacy consent:', error);
      throw error;
    }
  }

  /**
   * Check if coach can access athlete's conversations
   * Uses the per-coach athlete privacy document as source of truth.
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
   * Uses the per-coach athlete privacy document as source of truth.
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
   * Get privacy settings from the per-coach athlete privacy document.
   */
  async getPrivacyFromCoachAthlete(athleteUserId: string, coachId: string): Promise<{shareConversations: boolean, shareSentiment: boolean} | null> {
    try {
      const coachPrivacyRef = doc(db, this.privacyCollection, athleteUserId, 'coaches', coachId);
      const coachPrivacySnap = await getDoc(coachPrivacyRef);

      if (coachPrivacySnap.exists()) {
        const data = coachPrivacySnap.data();
        return {
          shareConversations: data.shareConversations ?? true, // Default to true
          shareSentiment: data.shareSentiment ?? true // Default to true
        };
      }

      const athletePrivacyRef = doc(db, this.privacyCollection, athleteUserId);
      const athletePrivacySnap = await getDoc(athletePrivacyRef);
      if (athletePrivacySnap.exists()) {
        const data = athletePrivacySnap.data();
        if (!data.coachId || data.coachId === coachId) {
          return {
            shareConversations: data.shareConversationsWithCoach ?? true,
            shareSentiment: data.shareSentimentWithCoach ?? true,
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('[PrivacyService] Error fetching privacy from coach settings:', error);
      return null;
    }
  }
}

export const privacyService = new PrivacyService();
