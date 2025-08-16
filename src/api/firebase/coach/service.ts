import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config';
import { CoachModel, CoachFirestoreData } from '../../../types/Coach';

class CoachService {
  /**
   * Get a coach profile by user ID
   */
  async getCoachProfile(userId: string): Promise<CoachModel | null> {
    try {
      // First check if user has activeCoachAccount flag
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.log('[CoachService] User document not found:', userId);
        return null;
      }
      
      const userData = userDoc.data();
      
      if (!userData.activeCoachAccount) {
        return null; // User doesn't have an active coach account
      }
      
      // Get coach profile using same userId as document ID
      const coachRef = doc(db, 'coaches', userId);
      const coachDoc = await getDoc(coachRef);
      
      if (!coachDoc.exists()) {
        return null;
      }
      
      const data = coachDoc.data();
      
      return new CoachModel(coachDoc.id, data as CoachFirestoreData);
    } catch (error) {
      console.error('Error fetching coach profile:', error);
      throw error;
    }
  }

  /**
   * Create a partner profile
   */
  async createPartnerProfile(userId: string, referralCode?: string): Promise<CoachModel> {
    try {
      // Check if user already has a coach profile
      const existingProfile = await this.getCoachProfile(userId);
      if (existingProfile) {
        throw new Error('User already has a coach profile');
      }

      // Get user data to check for existing Stripe account
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      
      const userData = userDoc.data();
      const existingStripeId = userData.creator?.stripeAccountId;

      // Generate referral code if not provided
      const finalReferralCode = referralCode || this.generateReferralCode();
      
      // Check if referral code already exists
      if (await this.referralCodeExists(finalReferralCode)) {
        throw new Error('Referral code already exists. Please try a different one.');
      }

      const batch = writeBatch(db);
      
      // Create coach profile using userId as document ID
      const coachRef = doc(db, 'coaches', userId);
      const coachData = {
        userId,
        referralCode: finalReferralCode,
        userType: 'partner',
        subscriptionStatus: 'partner',
        stripeCustomerId: existingStripeId || undefined,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      batch.set(coachRef, coachData);
      
      // Update user with activeCoachAccount flag
      batch.update(userRef, { 
        activeCoachAccount: true,
        updatedAt: serverTimestamp()
      });
      
      await batch.commit();
      
      // Add referral code to lookup table (after batch commit)
      await this.addReferralCodeToLookup(finalReferralCode, userId);
      
      return new CoachModel(userId, {
        ...coachData,
        createdAt: new Date(),
        updatedAt: new Date()
      } as CoachFirestoreData);
    } catch (error) {
      console.error('Error creating partner profile:', error);
      throw error;
    }
  }

  /**
   * Create a standard coach profile (with subscription)
   */
  async createCoachProfile(
    userId: string, 
    stripeCustomerId: string,
    subscriptionStatus: string,
    partnerCode?: string
  ): Promise<CoachModel> {
    try {
      const batch = writeBatch(db);
      
      let linkedPartnerId: string | undefined;
      
      // If partner code provided, validate and link
      if (partnerCode) {
        const partner = await this.getCoachByReferralCode(partnerCode);
        if (partner && partner.userType === 'partner') {
          linkedPartnerId = partner.id;
        }
      }
      
      // Generate referral code for coach
      const coachReferralCode = this.generateReferralCode();
      
      // Create coach profile using userId as document ID
      const coachRef = doc(db, 'coaches', userId);
      const coachData = {
        userId,
        referralCode: coachReferralCode,
        userType: 'coach',
        subscriptionStatus,
        stripeCustomerId,
        linkedPartnerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      batch.set(coachRef, coachData);
      
      // Update user with activeCoachAccount flag
      const userRef = doc(db, 'users', userId);
      batch.update(userRef, { 
        activeCoachAccount: true,
        updatedAt: serverTimestamp()
      });
      
      await batch.commit();
      
      // Add referral code to lookup table (after batch commit)
      await this.addReferralCodeToLookup(coachReferralCode, userId);
      
      return new CoachModel(userId, {
        ...coachData,
        createdAt: new Date(),
        updatedAt: new Date()
      } as CoachFirestoreData);
    } catch (error) {
      console.error('Error creating coach profile:', error);
      throw error;
    }
  }

  /**
   * Get coach by referral code
   */
  async getCoachByReferralCode(referralCode: string): Promise<CoachModel | null> {
    try {
      const coachesRef = collection(db, 'coaches');
      const q = query(coachesRef, where('referralCode', '==', referralCode.toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      return new CoachModel(doc.id, doc.data() as CoachFirestoreData);
    } catch (error) {
      console.error('Error fetching coach by referral code:', error);
      throw error;
    }
  }

  /**
   * Check if referral code exists using lookup table
   */
  async referralCodeExists(referralCode: string): Promise<boolean> {
    try {
      const lookupRef = doc(db, 'referralCodeLookup', referralCode.toUpperCase());
      const lookupDoc = await getDoc(lookupRef);
      return lookupDoc.exists();
    } catch (error) {
      console.error('Error checking referral code:', error);
      return false;
    }
  }

  /**
   * Add referral code to lookup table
   */
  private async addReferralCodeToLookup(referralCode: string, coachId: string): Promise<void> {
    try {
      const lookupRef = doc(db, 'referralCodeLookup', referralCode.toUpperCase());
      await setDoc(lookupRef, {
        coachId,
        referralCode: referralCode.toUpperCase(),
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding referral code to lookup:', error);
      throw error;
    }
  }

  /**
   * Remove referral code from lookup table
   */
  private async removeReferralCodeFromLookup(referralCode: string): Promise<void> {
    try {
      const lookupRef = doc(db, 'referralCodeLookup', referralCode.toUpperCase());
      await deleteDoc(lookupRef);
    } catch (error) {
      console.error('Error removing referral code from lookup:', error);
      // Don't throw - this is cleanup, shouldn't fail the main operation
    }
  }

  /**
   * Generate alternative referral code suggestions when the desired one exists
   */
  async generateReferralCodeSuggestions(desiredCode: string): Promise<string[]> {
    const suggestions: string[] = [];
    const baseCode = desiredCode.toUpperCase();
    
    // Try appending numbers 1-9
    for (let i = 1; i <= 9; i++) {
      const suggestion = `${baseCode}${i}`;
      if (!(await this.referralCodeExists(suggestion))) {
        suggestions.push(suggestion);
        if (suggestions.length >= 3) break; // Limit to 3 suggestions
      }
    }
    
    // If still need more suggestions, try 2-digit numbers
    if (suggestions.length < 3) {
      for (let i = 10; i <= 99; i++) {
        const suggestion = `${baseCode}${i}`;
        if (!(await this.referralCodeExists(suggestion))) {
          suggestions.push(suggestion);
          if (suggestions.length >= 3) break;
        }
      }
    }
    
    // If still need more, try some random suffixes
    if (suggestions.length < 3) {
      const suffixes = ['X', 'Z', 'PRO', 'VIP', 'PLUS'];
      for (const suffix of suffixes) {
        const suggestion = `${baseCode}${suffix}`;
        if (!(await this.referralCodeExists(suggestion))) {
          suggestions.push(suggestion);
          if (suggestions.length >= 3) break;
        }
      }
    }
    
    return suggestions;
  }

  /**
   * Validate and suggest referral codes
   */
  async validateReferralCode(desiredCode: string): Promise<{
    isAvailable: boolean;
    suggestions?: string[];
    message?: string;
  }> {
    try {
      const cleanCode = desiredCode.toUpperCase().trim();
      
      // Check if code is valid format (alphanumeric, 3-12 characters)
      if (!/^[A-Z0-9]{3,12}$/.test(cleanCode)) {
        return {
          isAvailable: false,
          message: 'Referral code must be 3-12 characters and contain only letters and numbers'
        };
      }
      
      // Check if code exists
      const exists = await this.referralCodeExists(cleanCode);
      
      if (!exists) {
        return {
          isAvailable: true,
          message: 'Referral code is available!'
        };
      }
      
      // Generate suggestions
      const suggestions = await this.generateReferralCodeSuggestions(cleanCode);
      
      return {
        isAvailable: false,
        suggestions,
        message: `"${cleanCode}" is already taken. Here are some available alternatives:`
      };
      
    } catch (error) {
      console.error('Error validating referral code:', error);
      return {
        isAvailable: false,
        message: 'Error checking referral code availability'
      };
    }
  }

  /**
   * Generate a unique referral code
   */
  private generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Utility method to create lookup entries for existing referral codes
   * This is for migrating existing coaches to the new lookup system
   */
  async createLookupForExistingCodes(): Promise<void> {
    try {
      console.log('[CoachService] Creating lookup entries for existing referral codes...');
      
      // Get all coaches
      const coachesRef = collection(db, 'coaches');
      const querySnapshot = await getDocs(coachesRef);
      
      const batch = writeBatch(db);
      let count = 0;
      
      querySnapshot.forEach((coachDoc) => {
        const coachData = coachDoc.data();
        if (coachData.referralCode) {
          const lookupRef = doc(db, 'referralCodeLookup', coachData.referralCode.toUpperCase());
          batch.set(lookupRef, {
            coachId: coachDoc.id,
            referralCode: coachData.referralCode.toUpperCase(),
            createdAt: serverTimestamp()
          });
          count++;
        }
      });
      
      if (count > 0) {
        await batch.commit();
        console.log(`[CoachService] Created ${count} lookup entries`);
      } else {
        console.log('[CoachService] No referral codes found to migrate');
      }
    } catch (error) {
      console.error('Error creating lookup entries:', error);
      throw error;
    }
  }

  /**
   * Update coach subscription status
   */
  async updateSubscriptionStatus(userId: string, status: string): Promise<void> {
    try {
      const coachRef = doc(db, 'coaches', userId);
      await setDoc(coachRef, {
        subscriptionStatus: status,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating subscription status:', error);
      throw error;
    }
  }

  /**
   * Link athlete to coach
   */
  async linkAthleteToCoach(coachId: string, athleteUserId: string): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      // Create coach-athlete relationship
      const coachAthleteRef = doc(collection(db, 'coachAthletes'));
      batch.set(coachAthleteRef, {
        coachId,
        athleteUserId,
        linkedAt: serverTimestamp()
      });
      
      // Update athlete's user document
      const userRef = doc(db, 'users', athleteUserId);
      batch.update(userRef, {
        linkedCoachId: coachId,
        updatedAt: serverTimestamp()
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error linking athlete to coach:', error);
      throw error;
    }
  }

  /**
   * Get coach's athletes
   */
  async getCoachAthletes(coachId: string): Promise<string[]> {
    try {
      const coachAthletesRef = collection(db, 'coachAthletes');
      const q = query(coachAthletesRef, where('coachId', '==', coachId));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => doc.data().athleteUserId);
    } catch (error) {
      console.error('Error fetching coach athletes:', error);
      throw error;
    }
  }
}

export const coachService = new CoachService();
