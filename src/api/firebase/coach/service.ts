import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch, addDoc, deleteDoc, orderBy, limit, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { CoachModel, CoachFirestoreData } from '../../../types/Coach';
import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../../../utils/formatDate';
import { privacyService } from '../privacy/service';

export interface DailySentimentRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  sentimentScore: number; // -1 to 1
  messageCount: number;
  lastAnalyzedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: Date;
  type: 'text' | 'image' | 'system';
}

export interface ConversationSession {
  id: string;
  athleteUserId: string;
  startTime: Date;
  endTime: Date;
  messages: ConversationMessage[];
}

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
        console.log('[CoachService] User document not found:', userId, '— falling back to coaches collection.');
        // Fallback: if a coach profile exists, allow access and backfill activeCoachAccount flag
        const coachRef = doc(db, 'coaches', userId);
        const coachDoc = await getDoc(coachRef);
        if (coachDoc.exists()) {
          try {
            // Attempt to set activeCoachAccount=true if users doc exists later
            const userRef = doc(db, 'users', userId);
            await setDoc(userRef, { activeCoachAccount: true, updatedAt: dateToUnixTimestamp(new Date()) }, { merge: true });
          } catch (_) { /* non-blocking */ }
          return new CoachModel(coachDoc.id, coachDoc.data() as CoachFirestoreData);
        }
        return null;
      }
      
      const userData = userDoc.data();
      
      // Check if user has activeCoachAccount flag OR if they have a coach profile
      if (!userData.activeCoachAccount) {
        // Fallback: Check if coach profile exists directly
        const coachRef = doc(db, 'coaches', userId);
        const coachDoc = await getDoc(coachRef);
        
        if (!coachDoc.exists()) {
          console.log('[CoachService] No activeCoachAccount flag and no coach profile found');
          return null;
        }
        
        // Coach profile exists, so update the user document
        console.log('[CoachService] Coach profile found, updating user activeCoachAccount flag');
        await updateDoc(userRef, { activeCoachAccount: true });
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
   * Disconnect athlete from coach (soft delete)
   */
  async disconnectAthleteFromCoach(coachId: string, athleteUserId: string): Promise<void> {
    try {
      const now = dateToUnixTimestamp(new Date());
      const coachAthletesRef = collection(db, 'coachAthletes');
      const existingQuery = query(
        coachAthletesRef,
        where('coachId', '==', coachId),
        where('athleteUserId', '==', athleteUserId)
      );
      const existingSnapshot = await getDocs(existingQuery);
      await Promise.all(existingSnapshot.docs.map(async (docSnap) => {
        await setDoc(docSnap.ref, { status: 'disconnected', disconnectedAt: now, updatedAt: now }, { merge: true });
      }));
    } catch (error) {
      console.error('Error disconnecting athlete from coach:', error);
      throw error;
    }
  }

  /**
   * List coaches connected to an athlete
   */
  async getConnectedCoaches(athleteUserId: string): Promise<Array<{ id: string; data: CoachFirestoreData }>> {
    try {
      const coachAthletesRef = collection(db, 'coachAthletes');
      const q = query(coachAthletesRef, where('athleteUserId', '==', athleteUserId));
      const links = await getDocs(q);
      const activeCoachIds = links.docs
        .filter(d => (d.data() as any).status !== 'disconnected')
        .map(d => (d.data() as any).coachId);
      if (activeCoachIds.length === 0) return [];
      const coachesRef = collection(db, 'coaches');
      const result: Array<{ id: string; data: CoachFirestoreData }> = [];
      for (const coachId of activeCoachIds) {
        const cDoc = await getDoc(doc(coachesRef, coachId));
        if (cDoc.exists()) result.push({ id: cDoc.id, data: cDoc.data() as CoachFirestoreData });
      }
      return result;
    } catch (error) {
      console.error('Error getting connected coaches:', error);
      return [];
    }
  }

  /**
   * Connect a coach to another coach using referral code.
   * Adds each other to connectedCoaches array on both coach documents.
   */
  async connectCoachToCoachByReferralCode(inviteeUserId: string, inviteeUsername: string, inviteeEmail: string, referralCode: string): Promise<{ success: boolean; message?: string }> {
    try {
      const clean = referralCode.toUpperCase().trim();
      if (!clean) return { success: false, message: 'Missing referral code' };

      // Find inviter coach by referral code
      const coachesRef = collection(db, 'coaches');
      const q = query(coachesRef, where('referralCode', '==', clean));
      const snap = await getDocs(q);
      if (snap.empty) return { success: false, message: 'Invalid referral code' };
      const inviterDoc = snap.docs[0];
      const inviterId = inviterDoc.id;

      // Load invitee coach document (must exist)
      const inviteeRef = doc(db, 'coaches', inviteeUserId);
      const inviteeSnap = await getDoc(inviteeRef);
      if (!inviteeSnap.exists()) return { success: false, message: 'Invitee coach profile missing' };

      const now = dateToUnixTimestamp(new Date());
      const inviteeEntry = { userId: inviteeUserId, username: inviteeUsername || '', email: inviteeEmail || '', connectedAt: now };

      // Get inviter basic info for reciprocal entry
      const inviterData = inviterDoc.data() as any;
      const inviterEntry = { userId: inviterId, username: inviterData?.username || '', email: inviterData?.email || '', connectedAt: now };

      await Promise.all([
        setDoc(inviterDoc.ref, { connectedCoaches: arrayUnion(inviteeEntry), updatedAt: now }, { merge: true }),
        setDoc(inviteeRef, { connectedCoaches: arrayUnion(inviterEntry), updatedAt: now }, { merge: true })
      ]);
      return { success: true };
    } catch (error: any) {
      console.error('Error connecting coach-to-coach:', error);
      return { success: false, message: error?.message || 'Unknown error' };
    }
  }

  /**
   * List connected coaches for a coach (reads the connectedCoaches array)
   */
  async getConnectedCoachesForCoach(coachId: string): Promise<Array<{ userId: string; username: string; email: string; connectedAt?: number }>> {
    try {
      const ref = doc(db, 'coaches', coachId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return [];
      const data = snap.data() as any;
      const list = Array.isArray(data?.connectedCoaches) ? data.connectedCoaches : [];
      // Dedupe by userId in case multiple entries were appended with different timestamps
      const byId = new Map<string, { userId: string; username: string; email: string; connectedAt?: number }>();
      list.forEach((e: any) => {
        if (!e || !e.userId) return;
        const existing = byId.get(e.userId);
        if (!existing || (typeof e.connectedAt === 'number' && (existing.connectedAt || 0) < e.connectedAt)) {
          byId.set(e.userId, { userId: e.userId, username: e.username || '', email: e.email || '', connectedAt: e.connectedAt });
        }
      });
      return Array.from(byId.values()).sort((a, b) => (b.connectedAt || 0) - (a.connectedAt || 0));
    } catch (error) {
      console.error('Error reading connected coaches:', error);
      return [];
    }
  }

  /** Privacy helpers */
  async getPrivacyForCoach(athleteUserId: string, coachId: string): Promise<any | null> {
    try {
      const ref = doc(db, 'athlete-privacy-settings', athleteUserId, 'coaches', coachId);
      const snap = await getDoc(ref);
      return snap.exists() ? snap.data() : null;
    } catch (error) {
      console.error('Error fetching privacy for coach:', error);
      return null;
    }
  }

  async setPrivacyForCoach(athleteUserId: string, coachId: string, partial: Record<string, any>): Promise<void> {
    const now = dateToUnixTimestamp(new Date());
    const ref = doc(db, 'athlete-privacy-settings', athleteUserId, 'coaches', coachId);
    await setDoc(ref, { ...partial, updatedAt: now, createdAt: partial.createdAt ?? now }, { merge: true });
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
        stripeCustomerId: existingStripeId || '',
        createdAt: dateToUnixTimestamp(new Date()),
        updatedAt: dateToUnixTimestamp(new Date())
      };
      
      batch.set(coachRef, coachData);
      
      // Update user with activeCoachAccount flag
      batch.update(userRef, { 
        activeCoachAccount: true,
        updatedAt: dateToUnixTimestamp(new Date())
      });
      
      await batch.commit();
      
      // Add referral code to lookup table (after batch commit)
      await this.addReferralCodeToLookup(finalReferralCode, userId);
      
      return new CoachModel(userId, coachData as unknown as CoachFirestoreData);
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
        createdAt: dateToUnixTimestamp(new Date()),
        updatedAt: dateToUnixTimestamp(new Date())
      };
      
      batch.set(coachRef, coachData);
      
      // Update user with activeCoachAccount flag
      const userRef = doc(db, 'users', userId);
      batch.update(userRef, { 
        activeCoachAccount: true,
        updatedAt: dateToUnixTimestamp(new Date())
      });
      
      await batch.commit();
      
      // Add referral code to lookup table (after batch commit)
      await this.addReferralCodeToLookup(coachReferralCode, userId);
      
      return new CoachModel(userId, coachData as unknown as CoachFirestoreData);
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
        updatedAt: dateToUnixTimestamp(new Date())
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
      const now = dateToUnixTimestamp(new Date());
      const coachAthleteRef = doc(collection(db, 'coachAthletes'));
      await setDoc(coachAthleteRef, {
        coachId,
        athleteUserId,
        status: 'active',
        linkedAt: now,
        createdAt: now,
        updatedAt: now
      });
      // Create default per-coach privacy doc
      const privacyRef = doc(db, 'athlete-privacy-settings', athleteUserId, 'coaches', coachId);
      await setDoc(privacyRef, {
        // Conservative defaults; adjust as needed
        shareSentiment: true,
        shareActivity: true,
        createdAt: now,
        updatedAt: now
      }, { merge: true });
    } catch (error) {
      console.error('Error linking athlete to coach:', error);
      throw error;
    }
  }

  /**
   * Get coach's athletes (simple list of IDs)
   */
  async getCoachAthletes(coachId: string): Promise<string[]> {
    try {
      const coachAthletesRef = collection(db, 'coachAthletes');
      const q = query(coachAthletesRef, where('coachId', '==', coachId));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs
        .filter(d => (d.data() as any).status !== 'disconnected')
        .map(doc => doc.data().athleteUserId);
    } catch (error) {
      console.error('Error fetching coach athletes:', error);
      throw error;
    }
  }

  /**
   * Get detailed athlete data for coach dashboard
   */
  async getConnectedAthletes(coachId: string): Promise<any[]> {
    try {
      console.log(`[CoachService] Fetching connected athletes for coach: ${coachId}`);

      // Query coachAthletes collection for active connections
      const coachAthletesRef = collection(db, 'coachAthletes');
      const q = query(coachAthletesRef, where('coachId', '==', coachId));
      const coachAthletesSnapshot = await getDocs(q);
      
      console.log(`[CoachService] Found ${coachAthletesSnapshot.docs.length} coachAthletes documents`);
      
      const athletes = [];
      const seenAthleteIds = new Set<string>(); // Track unique athlete IDs

      for (const coachAthleteDoc of coachAthletesSnapshot.docs) {
        const coachAthleteData = coachAthleteDoc.data();
        const athleteUserId = coachAthleteData.athleteUserId;
        
        console.log(`[CoachService] Processing coachAthlete document:`, {
          docId: coachAthleteDoc.id,
          athleteUserId,
          status: coachAthleteData.status,
          linkedAt: coachAthleteData.linkedAt
        });

        // Skip if we've already processed this athlete (deduplication)
        if (seenAthleteIds.has(athleteUserId)) {
          console.log(`[CoachService] Skipping duplicate athlete: ${athleteUserId}`);
          continue;
        }
        
        // Only include active connections (skip disconnected ones)
        if (coachAthleteData.status && coachAthleteData.status !== 'active') {
          console.log(`[CoachService] Skipping inactive athlete: ${athleteUserId} (status: ${coachAthleteData.status})`);
          continue;
        }

        seenAthleteIds.add(athleteUserId);

        // Fetch user profile for each athlete
        const userRef = doc(db, 'users', athleteUserId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Get additional stats (conversations, sessions, etc.)
          // Defensive: ensure we have a valid instance context; fallback to singleton
          const self = (this as CoachService | undefined) || coachService;
          const athleteStats = await self.getAthleteStats(athleteUserId);

          // Last active should prioritize most recent conversation; fallback to coachAthletes.updatedAt/linkedAt
          const conversationDate = athleteStats.lastConversationDate;
          const linkUpdated = convertFirestoreTimestamp(coachAthleteData.updatedAt || coachAthleteData.linkedAt);
          const lastActive = conversationDate && !isNaN(conversationDate.getTime())
            ? conversationDate
            : linkUpdated;
          
          athletes.push({
            id: athleteUserId,
            displayName: userData.displayName || userData.username || 'Unknown User',
            email: userData.email || '',
            profileImageUrl: userData.profileImageUrl,
            linkedAt: convertFirestoreTimestamp(coachAthleteData.linkedAt),
            lastActiveDate: lastActive,
            ...athleteStats
          });
        }
      }

      console.log(`[CoachService] Found ${athletes.length} unique connected athletes`);
      return athletes;

    } catch (error) {
      console.error('[CoachService] Error fetching connected athletes:', error);
      return [];
    }
  }

  /**
   * Get athlete statistics and sentiment analysis
   */
  private async getAthleteStats(athleteUserId: string): Promise<{
    conversationCount: number;
    totalSessions: number;
    weeklyGoalProgress: number;
    sentimentScore: number;
    lastConversationDate?: Date;
  }> {
    try {
      console.log(`[CoachService] Fetching real stats for athlete: ${athleteUserId}`);

      // 1. Get conversation count and messages for sentiment analysis
      const conversationsRef = collection(db, 'conversations');
      const conversationQuery = query(conversationsRef, where('userId', '==', athleteUserId));
      const conversationSnapshot = await getDocs(conversationQuery);
      
      let totalMessages = 0;
      let lastConversationDate: Date | undefined;
      let allMessageContent: string[] = [];

      // Process each conversation document
      for (const conversationDoc of conversationSnapshot.docs) {
        const conversationData = conversationDoc.data();
        
        // Count messages in this conversation
        if (conversationData.messages && Array.isArray(conversationData.messages)) {
          totalMessages += conversationData.messages.length;
          
          // Extract message content for sentiment analysis
          conversationData.messages.forEach((message: any) => {
            if (message.content && typeof message.content === 'string') {
              allMessageContent.push(message.content);
            }
          });
        }
        
        // Track most recent conversation
        if (conversationData.updatedAt || conversationData.createdAt) {
          const conversationDate = convertFirestoreTimestamp(conversationData.updatedAt || conversationData.createdAt);
          if (!lastConversationDate || conversationDate > lastConversationDate) {
            lastConversationDate = conversationDate;
          }
        }
      }

      console.log(`[CoachService] Found ${conversationSnapshot.docs.length} conversations with ${totalMessages} total messages`);

      // 2. Get workout sessions (you might have a different collection name)
      // For now, we'll check if you have workout-related collections
      let totalSessions = 0;
      try {
        // Try to query common workout collection names
        const workoutCollections = ['workouts', 'sessions', 'exercises', 'detailed-workouts'];
        
        for (const collectionName of workoutCollections) {
          try {
            const workoutRef = collection(db, collectionName);
            const workoutQuery = query(workoutRef, where('userId', '==', athleteUserId));
            const workoutSnapshot = await getDocs(workoutQuery);
            
            if (workoutSnapshot.docs.length > 0) {
              totalSessions += workoutSnapshot.docs.length;
              console.log(`[CoachService] Found ${workoutSnapshot.docs.length} documents in ${collectionName}`);
              break; // Use the first collection that has data
            }
          } catch (collectionError) {
            // Collection might not exist, continue to next one
            continue;
          }
        }
      } catch (workoutError) {
        console.log('[CoachService] No workout data found, using 0 sessions');
      }

      // 3. Calculate weekly goal progress (placeholder - you'll need to implement based on your goals structure)
      let weeklyGoalProgress = 0;
      try {
        // You might have a goals or challenges collection
        const goalsRef = collection(db, 'user-challenge'); // Based on your existing structure
        const goalsQuery = query(goalsRef, where('userId', '==', athleteUserId));
        const goalsSnapshot = await getDocs(goalsQuery);
        
        if (goalsSnapshot.docs.length > 0) {
          // Calculate average progress from active challenges
          let totalProgress = 0;
          let activeGoals = 0;
          
          goalsSnapshot.docs.forEach(doc => {
            const goalData = doc.data();
            if (goalData.progress !== undefined) {
              totalProgress += goalData.progress;
              activeGoals++;
            }
          });
          
          if (activeGoals > 0) {
            weeklyGoalProgress = Math.round(totalProgress / activeGoals);
          }
        }
      } catch (goalsError) {
        console.log('[CoachService] No goals data found, using 0% progress');
      }

      // 4. Basic sentiment analysis (temporary fallback)
      let sentimentScore = 0;
      if (allMessageContent.length > 0) {
        sentimentScore = this.calculateBasicSentiment(allMessageContent);
      }

      const stats = {
        conversationCount: totalMessages,
        totalSessions,
        weeklyGoalProgress,
        sentimentScore,
        lastConversationDate
      };

      console.log(`[CoachService] Calculated stats for ${athleteUserId}:`, stats);
      return stats;

    } catch (error) {
      console.error('[CoachService] Error fetching athlete stats:', error);
      return {
        conversationCount: 0,
        totalSessions: 0,
        weeklyGoalProgress: 0,
        sentimentScore: 0
      };
    }
  }

  /**
   * Advanced sentiment analysis using Hugging Face API
   */
  private async analyzeSentimentWithHF(messages: string[]): Promise<number> {
    try {
      console.log(`[CoachService] Analyzing sentiment for ${messages.length} messages using Hugging Face`);
      
      // Call our Netlify function
      const response = await fetch('/.netlify/functions/analyze-sentiment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages })
      });
      
      if (!response.ok) {
        throw new Error(`Sentiment API responded with status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(`Sentiment API error: ${result.error}`);
      }
      
      console.log(`[CoachService] HF Sentiment analysis result:`, result);
      return result.sentimentScore || 0;
      
    } catch (error) {
      console.error('[CoachService] Hugging Face sentiment analysis failed:', error);
      throw error; // Re-throw to trigger fallback
    }
  }

  /**
   * Analyze sentiment using unified API endpoint
   */
  private async analyzeSentimentWithAPI(messages: string[], userId: string): Promise<number> {
    try {
      console.log(`[CoachService] Calling sentiment API for ${messages.length} messages`);
      
      const response = await fetch('/.netlify/functions/analyze-sentiment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          userId,
          platform: 'web',
          strategy: 'hybrid'
        })
      });

      if (!response.ok) {
        throw new Error(`Sentiment API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(`Sentiment API error: ${result.error}`);
      }

      console.log(`[CoachService] Sentiment API result: ${result.sentimentScore} (${result.metadata?.strategy})`);
      return result.sentimentScore;

    } catch (error) {
      console.error('[CoachService] Sentiment API failed, using fallback:', error);
      // Fallback to basic analysis if API fails
      return this.calculateBasicSentiment(messages);
    }
  }

  /**
   * Basic sentiment analysis using keyword matching (fallback)
   */
  private calculateBasicSentiment(messages: string[]): number {
    const positiveWords = [
      // Basic positive
      'good', 'great', 'awesome', 'excellent', 'happy', 'love', 'amazing', 'perfect', 'wonderful', 'fantastic',
      // Emotions & feelings
      'excited', 'motivated', 'proud', 'confident', 'strong', 'energetic', 'optimistic', 'cheerful', 'joyful',
      'grateful', 'blessed', 'content', 'satisfied', 'pleased', 'delighted', 'thrilled', 'ecstatic',
      // Performance & achievement
      'successful', 'accomplished', 'achieved', 'improved', 'progress', 'better', 'best', 'winning', 'victory',
      'breakthrough', 'milestone', 'personal record', 'pr', 'crushed', 'nailed', 'killed it', 'smashed',
      // Physical & mental state
      'strong', 'powerful', 'fit', 'healthy', 'energized', 'refreshed', 'recovered', 'ready', 'focused',
      'determined', 'committed', 'dedicated', 'disciplined', 'consistent', 'resilient',
      // Social & support
      'supported', 'encouraged', 'inspired', 'uplifted', 'connected', 'understood', 'appreciated',
      // General positive
      'yes', 'absolutely', 'definitely', 'certainly', 'outstanding', 'incredible', 'remarkable', 'impressive'
    ];
    
    const negativeWords = [
      // Basic negative
      'bad', 'terrible', 'awful', 'hate', 'sad', 'angry', 'frustrated', 'disappointed', 'horrible', 'worst',
      // Emotions & feelings
      'depressed', 'anxious', 'worried', 'stressed', 'overwhelmed', 'discouraged', 'hopeless', 'defeated',
      'miserable', 'upset', 'annoyed', 'irritated', 'furious', 'devastated', 'heartbroken', 'lonely',
      // Physical & mental state
      'tired', 'exhausted', 'weak', 'sick', 'injured', 'hurt', 'pain', 'painful', 'sore', 'aching',
      'drained', 'burnt out', 'burnout', 'fatigued', 'sluggish', 'unmotivated', 'lazy', 'lethargic',
      // Performance & setbacks
      'failed', 'failure', 'struggling', 'stuck', 'plateau', 'regression', 'setback', 'disappointed',
      'underperformed', 'missed', 'skipped', 'quit', 'gave up', 'surrender', 'defeated', 'lost',
      // Mental challenges
      'confused', 'lost', 'uncertain', 'doubtful', 'insecure', 'self-doubt', 'imposter', 'inadequate',
      'worthless', 'useless', 'hopeless', 'helpless', 'powerless', 'overwhelmed', 'stressed out',
      // Social & isolation
      'alone', 'isolated', 'unsupported', 'misunderstood', 'ignored', 'rejected', 'abandoned',
      // General negative
      'no', 'never', 'impossible', 'can\'t', 'won\'t', 'shouldn\'t', 'terrible', 'disaster', 'nightmare'
    ];
    
    let positiveCount = 0;
    let negativeCount = 0;
    let totalWords = 0;
    
    messages.forEach(message => {
      const words = message.toLowerCase().split(/\s+/);
      totalWords += words.length;
      
      words.forEach(word => {
        if (positiveWords.includes(word)) positiveCount++;
        if (negativeWords.includes(word)) negativeCount++;
      });
    });
    
    if (totalWords === 0) return 0;
    
    // Calculate sentiment score between -1 and 1
    const sentimentRatio = (positiveCount - negativeCount) / totalWords;
    return Math.max(-1, Math.min(1, sentimentRatio * 10)); // Scale and clamp
  }

  /**
   * Process sentiment analysis for the last N days for a specific athlete
   */
  async processSentimentForAthlete(athleteUserId: string, days: number = 28): Promise<DailySentimentRecord[]> {
    try {
      console.log(`🔄 [CoachService] STEP 1: Starting sentiment processing for athlete ${athleteUserId} for last ${days} days`);
      console.log(`📅 [CoachService] Current date: ${new Date().toISOString()}`);
      
      // First, get all conversation dates for this user
      const conversationDates = await this.getConversationDates(athleteUserId);
      console.log(`📊 [CoachService] STEP 2: Found ${conversationDates.length} unique conversation dates:`, conversationDates);
      
      // Process ALL conversation dates (no filtering)
      const today = new Date();
      
      console.log(`🗓️ [CoachService] STEP 3: Processing ALL conversation dates - Today: ${today.toISOString().split('T')[0]}`);
      
      const recentDates = conversationDates.map(dateString => {
        const conversationDate = new Date(dateString);
        const daysAgo = Math.floor((today.getTime() - conversationDate.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   📅 Date ${dateString}: ✅ INCLUDED (${daysAgo} days ago)`);
        return dateString;
      });
      
      console.log(`🎯 [CoachService] STEP 4: Processing ${recentDates.length} conversation dates:`, recentDates);
      
      // Generate complete date range for the last N days (including days with no conversations)
      const completeDateRange: string[] = [];
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        completeDateRange.push(dateString);
      }
      
      console.log(`📅 [CoachService] STEP 4b: Complete ${days}-day range:`, completeDateRange);
      
      const results: DailySentimentRecord[] = [];
      
      // Process each day in the complete range
      for (let i = 0; i < completeDateRange.length; i++) {
        const dateString = completeDateRange[i];
        const hasConversation = recentDates.includes(dateString);
        
        console.log(`\n🔍 [CoachService] STEP 5.${i + 1}: Processing ${dateString} ${hasConversation ? '(HAS CONVERSATIONS)' : '(NO CONVERSATIONS)'}`);
        
        let messagesForDate: string[] = [];
        
        if (hasConversation) {
          // Get messages for this specific date
          messagesForDate = await this.getMessagesForDate(athleteUserId, dateString);
          console.log(`📝 [CoachService] STEP 5.${i + 1}a: Found ${messagesForDate.length} messages for ${dateString}`);
        } else {
          console.log(`📝 [CoachService] STEP 5.${i + 1}a: No conversations on ${dateString} - will create "No Data" record`);
        }
        
        // Create or update sentiment record (will be "No Data" if no messages)
        const sentimentRecord = await this.createOrUpdateDailySentiment(athleteUserId, dateString, messagesForDate);
        console.log(`💭 [CoachService] STEP 5.${i + 1}b: Sentiment record for ${dateString}:`, sentimentRecord ? `✅ Created (sentiment: ${sentimentRecord.sentimentScore}, messages: ${sentimentRecord.messageCount})` : '❌ Failed');
        
        if (sentimentRecord) {
          results.push(sentimentRecord);
        }
      }
      
      // Sort results by date (newest first)
      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      console.log(`\n🎉 [CoachService] STEP 6: FINAL RESULTS - Processed ${results.length} days of sentiment data:`);
      results.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.date}: ${result.sentimentScore.toFixed(3)} sentiment (${result.messageCount} messages)`);
      });
      
      return results;
      
    } catch (error) {
      console.error('❌ [CoachService] Error processing sentiment for athlete:', error);
      return [];
    }
  }

  /**
   * Get all unique conversation dates for a user - USING SAME LOGIC AS CONVERSATION MODAL
   */
  private async getConversationDates(userId: string): Promise<string[]> {
    try {
      console.log(`🔍 [CoachService] Getting conversation dates for user: ${userId} - USING CONVERSATION MODAL LOGIC`);
      
      // Use EXACT same logic as getAthleteConversations
      const conversationsRef = collection(db, 'conversations');
      const conversationQuery = query(conversationsRef, where('userId', '==', userId));
      const conversationSnapshot = await getDocs(conversationQuery);
      
      console.log(`📄 [CoachService] Found ${conversationSnapshot.docs.length} conversation documents`);
      
      const dates = new Set<string>();
      const sessions: Array<{id: string, startTime: Date}> = [];
      
      // Create sessions EXACTLY like the conversation modal does
      conversationSnapshot.docs.forEach(docSnapshot => {
        const conversationData = docSnapshot.data();
        
        if (conversationData.messages && Array.isArray(conversationData.messages)) {
          const session = {
            id: docSnapshot.id,
            startTime: convertFirestoreTimestamp(conversationData.createdAt)
          };
          sessions.push(session);
        }
      });
      
      // Sort sessions by start time (newest first) - SAME as conversation modal
      sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      
      // Extract dates from sessions - SAME display logic as conversation modal
      sessions.forEach((session, index) => {
        // Use LOCAL DATE STRING like the conversation modal displays
        const localDateString = session.startTime.toLocaleDateString('en-CA'); // YYYY-MM-DD format
        
        console.log(`   📅 Session ${index + 1} (${session.id}): startTime=${session.startTime.toISOString()}, localDate=${localDateString}`);
        
        // Special logging for Aug 11
        if (localDateString === '2025-08-11') {
          console.log(`🚨 FOUND AUG 11 SESSION: ${session.id} at ${session.startTime.toISOString()}`);
        }
        
        dates.add(localDateString);
      });
      
      const sortedDates = Array.from(dates).sort((a, b) => b.localeCompare(a));
      console.log(`📊 [CoachService] Extracted ${dates.size} unique LOCAL dates from ${sessions.length} sessions:`, sortedDates);
      
      return sortedDates;
    } catch (error) {
      console.error('❌ [CoachService] Error getting conversation dates:', error);
      return [];
    }
  }

  /**
   * Get messages for a specific date - USING SAME LOCAL DATE LOGIC AS CONVERSATION MODAL
   */
  private async getMessagesForDate(userId: string, dateString: string): Promise<string[]> {
    try {
      console.log(`🔍 [CoachService] Searching for messages for user ${userId} on date ${dateString}`);
      
      const conversationsRef = collection(db, 'conversations');
      const conversationQuery = query(conversationsRef, where('userId', '==', userId));
      const conversationSnapshot = await getDocs(conversationQuery);
      
      console.log(`📄 [CoachService] Found ${conversationSnapshot.docs.length} conversation documents to check`);
      
      const messagesForDate: string[] = [];
      let totalMessagesChecked = 0;
      let userMessagesFound = 0;
      let conversationsMatchingDate = 0;
      let conversationsProcessed = 0;
      
      conversationSnapshot.docs.forEach(docSnapshot => {
        conversationsProcessed++;
        const conversationData = docSnapshot.data();
        
        // Use SAME LOCAL DATE logic as conversation modal
        const conversationDate = convertFirestoreTimestamp(conversationData.createdAt);
        const localDateString = conversationDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
        
        const matches = localDateString === dateString;
        console.log(`   📅 Conversation ${conversationsProcessed} (${docSnapshot.id.substring(0, 8)}...): ${localDateString} ${matches ? '✅ MATCHES' : '❌ NO MATCH'} (target: ${dateString})`);
        
        // Only process conversations that match the target date
        if (matches && conversationData.messages && Array.isArray(conversationData.messages)) {
          conversationsMatchingDate++;
          console.log(`      📝 Processing ${conversationData.messages.length} messages from matching conversation`);
          
          conversationData.messages.forEach((message: any, index: number) => {
            totalMessagesChecked++;
            
            if (message.isFromUser === true && message.content) {
              userMessagesFound++;
              messagesForDate.push(message.content);
              
              console.log(`      ✅ Message ${index + 1}: "${message.content.substring(0, 30)}..." (${message.content.length} chars)`);
            } else {
              console.log(`      ⏭️ Message ${index + 1}: ${!message.isFromUser ? 'AI message' : 'No content'} - skipped`);
            }
          });
        }
      });
      
      console.log(`📊 [CoachService] SUMMARY for ${dateString}:`);
      console.log(`   📄 Conversations processed: ${conversationsProcessed}`);
      console.log(`   ✅ Conversations matching date: ${conversationsMatchingDate}`);
      console.log(`   📝 Total messages checked: ${totalMessagesChecked}`);
      console.log(`   👤 User messages found: ${userMessagesFound}`);
      console.log(`   💬 Final message count: ${messagesForDate.length}`);
      
      return messagesForDate;
    } catch (error) {
      console.error(`❌ [CoachService] Error getting messages for ${dateString}:`, error);
      return [];
    }
  }

  /**
   * Create or update daily sentiment record
   */
  private async createOrUpdateDailySentiment(userId: string, dateString: string, messages: string[]): Promise<DailySentimentRecord | null> {
    try {
      const recordId = `${userId}_${dateString}`;
      const sentimentRef = doc(db, 'dailySentimentAnalysis', recordId);
      
      // Analyze sentiment using unified API
      console.log(`🤖 [CoachService] Analyzing sentiment for ${messages.length} messages on ${dateString}`);
      const sentimentScore = messages.length > 0 ? await this.analyzeSentimentWithAPI(messages, userId) : 0;
      console.log(`📊 [CoachService] Sentiment analysis result for ${dateString}: ${sentimentScore}`);
      
      const recordData = {
        id: recordId,
        userId,
        date: dateString,
        sentimentScore,
        messageCount: messages.length,
        lastAnalyzedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Check if record exists
      const existingDoc = await getDoc(sentimentRef);
      
      if (existingDoc.exists()) {
        // Update existing record
        await setDoc(sentimentRef, recordData, { merge: true });
        console.log(`[CoachService] Updated sentiment for ${dateString}: ${sentimentScore} (${messages.length} messages)`);
      } else {
        // Create new record
        await setDoc(sentimentRef, {
          ...recordData,
          createdAt: serverTimestamp()
        });
        console.log(`[CoachService] Created sentiment for ${dateString}: ${sentimentScore} (${messages.length} messages)`);
      }
      
      // Return the record with proper dates
      return {
        id: recordId,
        userId,
        date: dateString,
        sentimentScore,
        messageCount: messages.length,
        lastAnalyzedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
    } catch (error) {
      console.error(`[CoachService] Error creating/updating sentiment for ${dateString}:`, error);
      return null;
    }
  }

  /**
   * Get existing sentiment history for a user
   */
  async getDailySentimentHistory(userId: string, days: number = 28, coachId?: string): Promise<DailySentimentRecord[]> {
    try {
      console.log(`📊 [CoachService] Loading existing sentiment history for user: ${userId}`);
      
      // Check privacy settings if coachId is provided
      if (coachId) {
        const canAccess = await privacyService.canCoachAccessSentiment(userId, coachId);
        if (!canAccess) {
          console.log(`[CoachService] Coach ${coachId} does not have permission to access sentiment data for athlete ${userId}`);
          return []; // Return empty array if no permission
        }
      }
      
      const sentimentRef = collection(db, 'dailySentimentAnalysis');
      const q = query(
        sentimentRef,
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(days)
      );
      
      const snapshot = await getDocs(q);
      console.log(`📄 [CoachService] Found ${snapshot.docs.length} existing sentiment records`);
      
      const sentimentHistory: DailySentimentRecord[] = [];
      
      snapshot.docs.forEach((docSnapshot, index) => {
        const data = docSnapshot.data();
        
        // 🚨 Special logging for Aug 11 records
        if (data.date === '2025-08-11') {
          console.log(`🚨 FOUND EXISTING AUG 11 SENTIMENT RECORD:`, {
            id: data.id,
            date: data.date,
            sentimentScore: data.sentimentScore,
            messageCount: data.messageCount,
            lastAnalyzedAt: data.lastAnalyzedAt,
            createdAt: data.createdAt
          });
        }
        
        console.log(`   📊 Record ${index + 1}: ${data.date} → sentiment: ${data.sentimentScore}, messages: ${data.messageCount}`);
        
        sentimentHistory.push({
          id: data.id,
          userId: data.userId,
          date: data.date,
          sentimentScore: data.sentimentScore,
          messageCount: data.messageCount,
          lastAnalyzedAt: data.lastAnalyzedAt?.toDate?.() || new Date(data.lastAnalyzedAt),
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
        });
      });
      
      console.log(`📊 [CoachService] Loaded ${sentimentHistory.length} sentiment records, dates: ${sentimentHistory.map(r => r.date).join(', ')}`);
      
      return sentimentHistory; // Return in reverse chronological order (newest first)
    } catch (error) {
      console.error('[CoachService] Error fetching sentiment history:', error);
      return [];
    }
  }

  /**
   * Get conversation history for an athlete
   */
  async getAthleteConversations(athleteUserId: string, coachId?: string): Promise<ConversationSession[]> {
    try {
      console.log(`[CoachService] Fetching conversations for athlete: ${athleteUserId}`);
      
      // Check privacy settings if coachId is provided
      if (coachId) {
        const canAccess = await privacyService.canCoachAccessConversations(athleteUserId, coachId);
        if (!canAccess) {
          console.log(`[CoachService] Coach ${coachId} does not have permission to access conversations for athlete ${athleteUserId}`);
          return []; // Return empty array if no permission
        }
      }
      
      const conversationsRef = collection(db, 'conversations');
      const conversationQuery = query(conversationsRef, where('userId', '==', athleteUserId));
      const conversationSnapshot = await getDocs(conversationQuery);
      
      const sessions: ConversationSession[] = [];
      
      conversationSnapshot.docs.forEach(docSnapshot => {
        const conversationData = docSnapshot.data();
        
        if (conversationData.messages && Array.isArray(conversationData.messages)) {
          // Group messages by session (assuming each conversation document is a session)
          const session: ConversationSession = {
            id: docSnapshot.id,
            athleteUserId,
            startTime: convertFirestoreTimestamp(conversationData.createdAt),
            endTime: convertFirestoreTimestamp(conversationData.updatedAt),
            messages: conversationData.messages.map((msg: any) => ({
              id: msg.id || `${docSnapshot.id}_${msg.timestamp}`,
              content: msg.content || '',
              sender: msg.sender || (msg.isFromUser === false ? 'ai' : 'user'),
              timestamp: convertFirestoreTimestamp(msg.timestamp),
              type: msg.type || 'text'
            }))
          };
          
          // Sort messages by timestamp
          session.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          
          sessions.push(session);
        }
      });
      
      // Sort sessions by start time (newest first)
      sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      
      console.log(`[CoachService] Found ${sessions.length} conversation sessions with ${sessions.reduce((total, session) => total + session.messages.length, 0)} total messages`);
      
      return sessions;
    } catch (error) {
      console.error('[CoachService] Error fetching athlete conversations:', error);
      return [];
    }
  }

  /**
   * Connect an athlete to a coach using referral code
   */
  async connectAthleteToCoach(athleteUserId: string, referralCode: string): Promise<boolean> {
    try {
      console.log(`[CoachService] Connecting athlete ${athleteUserId} to coach with referral code: ${referralCode}`);
      
      // Find coach by referral code
      const coachesRef = collection(db, 'coaches');
      const coachQuery = query(coachesRef, where('referralCode', '==', referralCode));
      const coachSnapshot = await getDocs(coachQuery);
      
      if (coachSnapshot.empty) {
        console.error(`[CoachService] No coach found with referral code: ${referralCode}`);
        return false;
      }
      
      const coachDoc = coachSnapshot.docs[0];
      const coachId = coachDoc.id;
      
      console.log(`[CoachService] Found coach: ${coachId}`);
      
      // Check if connection already exists
      const coachAthletesRef = collection(db, 'coachAthletes');
      const existingQuery = query(
        coachAthletesRef,
        where('coachId', '==', coachId),
        where('athleteUserId', '==', athleteUserId)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        console.log(`[CoachService] Connection already exists between coach ${coachId} and athlete ${athleteUserId}`);
        return true; // Already connected
      }
      
      // Create coach-athlete relationship
      const now = dateToUnixTimestamp(new Date());
      const connectionData = {
        coachId,
        athleteUserId,
        status: 'active',
        linkedAt: now,
        createdAt: now,
        updatedAt: now
      };
      
      await addDoc(coachAthletesRef, connectionData);
      // Create default privacy for this coach
      const privacyRef = doc(db, 'athlete-privacy-settings', athleteUserId, 'coaches', coachId);
      await setDoc(privacyRef, {
        shareSentiment: true,
        shareActivity: true,
        createdAt: now,
        updatedAt: now
      }, { merge: true });
      
      console.log(`[CoachService] Successfully connected athlete ${athleteUserId} to coach ${coachId}`);
      return true;
      
    } catch (error) {
      console.error('[CoachService] Error connecting athlete to coach:', error);
      return false;
    }
  }

  /**
   * Find coach by referral code
   */
  async findCoachByReferralCode(referralCode: string): Promise<CoachModel | null> {
    try {
      const coachesRef = collection(db, 'coaches');
      const coachQuery = query(coachesRef, where('referralCode', '==', referralCode));
      const coachSnapshot = await getDocs(coachQuery);
      
      if (coachSnapshot.empty) {
        return null;
      }
      
      const coachDoc = coachSnapshot.docs[0];
      const coachData = coachDoc.data();
      
      return new CoachModel(coachDoc.id, coachData as CoachFirestoreData);
    } catch (error) {
      console.error('[CoachService] Error finding coach by referral code:', error);
      return null;
    }
  }

  /**
   * Create mock athlete data for testing (temporary method)
   */
  async createMockAthlete(coachId: string, athleteName: string, athleteEmail: string): Promise<void> {
    try {
      // Create a mock user document
      const mockUserId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userRef = doc(db, 'users', mockUserId);
      
      const now = dateToUnixTimestamp(new Date());
      await setDoc(userRef, {
        id: mockUserId,
        displayName: athleteName,
        email: athleteEmail,
        username: athleteName.toLowerCase().replace(/\s+/g, ''),
        profileImageUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(athleteName)}&background=E0FE10&color=000000&size=128`,
        createdAt: now,
        updatedAt: now
      });

      // Create coach-athlete relationship
      const coachAthleteRef = doc(collection(db, 'coachAthletes'));
      await setDoc(coachAthleteRef, {
        coachId: coachId,
        athleteUserId: mockUserId,
        linkedAt: now,
        status: 'active'
      });

      console.log(`[CoachService] Created mock athlete: ${athleteName} (${mockUserId})`);
    } catch (error) {
      console.error('[CoachService] Error creating mock athlete:', error);
      throw error;
    }
  }
}

export const coachService = new CoachService();
