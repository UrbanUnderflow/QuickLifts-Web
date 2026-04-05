import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc, orderBy, limit, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { CoachModel, CoachFirestoreData } from '../../../types/Coach';
import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../../../utils/formatDate';
import { privacyService } from '../privacy/service';
import { pulseCheckProvisioningService } from '../pulsecheckProvisioning/service';
import type { PulseCheckRosterVisibilityScope, PulseCheckTeamMembership, PulseCheckTeamMembershipRole } from '../pulsecheckProvisioning/types';

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

const PULSECHECK_ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const PULSECHECK_TEAMS_COLLECTION = 'pulsecheck-teams';
const PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION = 'pulsecheck-organization-memberships';
const PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';

const DIRECT_COACH_ROLES = new Set<PulseCheckTeamMembershipRole>(['team-admin', 'coach']);
const COACH_ACCESS_ROLES = new Set<PulseCheckTeamMembershipRole>(['team-admin', 'coach', 'performance-staff', 'support-staff']);

const toMembershipMillis = (value: any) => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'number') return value;
  return 0;
};

const membershipPriority = (membership: PulseCheckTeamMembership) => {
  switch (membership.role) {
    case 'team-admin':
      return 0;
    case 'coach':
      return 1;
    case 'performance-staff':
      return 2;
    case 'support-staff':
      return 3;
    default:
      return 9;
  }
};

const choosePrimaryOperatingMembership = (memberships: PulseCheckTeamMembership[]) =>
  [...memberships]
    .filter((membership) => COACH_ACCESS_ROLES.has(membership.role))
    .sort((left, right) => {
      const roleDelta = membershipPriority(left) - membershipPriority(right);
      if (roleDelta !== 0) return roleDelta;
      return toMembershipMillis(right.updatedAt || right.createdAt || right.grantedAt) - toMembershipMillis(left.updatedAt || left.createdAt || left.grantedAt);
    })[0] || null;

const canCoachMembershipSeeAthlete = (
  coachMembership: PulseCheckTeamMembership,
  athleteMembership: PulseCheckTeamMembership
) => {
  const scope = (coachMembership.rosterVisibilityScope || 'team') as PulseCheckRosterVisibilityScope;
  if (scope === 'none') return false;
  if (scope === 'assigned') {
    return (coachMembership.allowedAthleteIds || []).includes(athleteMembership.userId);
  }
  return true;
};

const defaultPulseCheckAthleteOnboarding = () => ({
  productConsentAccepted: false,
  productConsentAcceptedAt: null,
  productConsentVersion: '',
  entryOnboardingStep: 'name' as const,
  entryOnboardingName: '',
  researchConsentStatus: 'not-required' as const,
  researchConsentVersion: '',
  researchConsentRespondedAt: null,
  eligibleForResearchDataset: false,
  enrollmentMode: 'product-only' as const,
  targetPilotId: '',
  targetPilotName: '',
  targetCohortId: '',
  targetCohortName: '',
  requiredConsents: [],
  completedConsentIds: [],
  baselinePathStatus: 'pending' as const,
  baselinePathwayId: '',
});

class CoachService {
  private async listCoachTeamMemberships(coachId: string): Promise<PulseCheckTeamMembership[]> {
    const memberships = await pulseCheckProvisioningService.listUserTeamMemberships(coachId);
    return memberships.filter((membership) => COACH_ACCESS_ROLES.has(membership.role));
  }

  private async listPulseCheckAthleteConnectionsForCoach(
    coachId: string
  ): Promise<Array<{ athleteMembership: PulseCheckTeamMembership; coachMembership: PulseCheckTeamMembership; linkedAt: Date | null }>> {
    const coachMemberships = await this.listCoachTeamMemberships(coachId);
    if (coachMemberships.length === 0) return [];

    const byAthleteId = new Map<string, { athleteMembership: PulseCheckTeamMembership; coachMembership: PulseCheckTeamMembership; linkedAt: Date | null }>();

    const teamMembershipsByTeam = await Promise.all(
      coachMemberships.map(async (coachMembership) => ({
        coachMembership,
        members: await pulseCheckProvisioningService.listTeamMemberships(coachMembership.teamId),
      }))
    );

    for (const { coachMembership, members } of teamMembershipsByTeam) {
      const athleteMembers = members.filter(
        (membership) => membership.role === 'athlete' && canCoachMembershipSeeAthlete(coachMembership, membership)
      );

      for (const athleteMembership of athleteMembers) {
        const linkedAt = convertFirestoreTimestamp(
          athleteMembership.grantedAt || athleteMembership.createdAt || athleteMembership.updatedAt
        );
        const existing = byAthleteId.get(athleteMembership.userId);
        const existingTime = existing?.linkedAt?.getTime() || 0;
        const nextTime = linkedAt?.getTime() || 0;
        if (!existing || nextTime >= existingTime) {
          byAthleteId.set(athleteMembership.userId, {
            athleteMembership,
            coachMembership,
            linkedAt,
          });
        }
      }
    }

    return Array.from(byAthleteId.values());
  }

  private async ensureCoachOperatingContext(coachId: string): Promise<{ organizationId: string; teamId: string }> {
    const existingMembership = choosePrimaryOperatingMembership(await this.listCoachTeamMemberships(coachId));
    if (existingMembership) {
      return {
        organizationId: existingMembership.organizationId,
        teamId: existingMembership.teamId,
      };
    }

    const organizationId = `legacy-coach-org-${coachId}`;
    const teamId = `legacy-coach-team-${coachId}`;
    const now = serverTimestamp();

    const [userSnap, coachSnap] = await Promise.all([
      getDoc(doc(db, 'users', coachId)),
      getDoc(doc(db, 'coaches', coachId)),
    ]);

    const userData = userSnap.exists() ? (userSnap.data() as Record<string, any>) : {};
    const coachData = coachSnap.exists() ? (coachSnap.data() as Record<string, any>) : {};
    const coachName =
      String(userData.displayName || userData.username || coachData.username || userData.email || coachId).trim() || 'Coach';
    const coachEmail = String(userData.email || coachData.email || '').trim().toLowerCase();

    await Promise.all([
      setDoc(
        doc(db, PULSECHECK_ORGANIZATIONS_COLLECTION, organizationId),
        {
          displayName: `${coachName} Coaching`,
          legalName: `${coachName} Coaching`,
          organizationType: 'coach-led',
          status: 'active',
          legacySource: 'legacy-coach-roster',
          legacyCoachId: coachId,
          primaryCustomerAdminName: coachName,
          primaryCustomerAdminEmail: coachEmail,
          defaultStudyPosture: 'operational',
          defaultClinicianBridgeMode: 'none',
          notes: `Auto-created from coach-service bridge for ${coachName}.`,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, PULSECHECK_TEAMS_COLLECTION, teamId),
        {
          organizationId,
          displayName: `${coachName} Team`,
          teamType: 'coach-led',
          sportOrProgram: 'Coach-led organization',
          status: 'active',
          legacySource: 'legacy-coach-roster',
          legacyCoachId: coachId,
          defaultAdminName: coachName,
          defaultAdminEmail: coachEmail,
          defaultInvitePolicy: 'admin-staff-and-coaches',
          notes: `Auto-created from coach-service bridge for ${coachName}.`,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, PULSECHECK_ORGANIZATION_MEMBERSHIPS_COLLECTION, `${organizationId}_${coachId}`),
        {
          organizationId,
          userId: coachId,
          email: coachEmail,
          role: 'org-admin',
          status: 'active',
          grantedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
      setDoc(
        doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${teamId}_${coachId}`),
        {
          organizationId,
          teamId,
          userId: coachId,
          email: coachEmail,
          role: 'team-admin',
          title: 'Coach',
          permissionSetId: 'pulsecheck-team-admin-v1',
          rosterVisibilityScope: 'team',
          allowedAthleteIds: [],
          onboardingStatus: 'pending-profile',
          grantedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      ),
    ]);

    return { organizationId, teamId };
  }

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
   * Disconnect athlete from coach and remove legacy-sourced team memberships tied to that coach.
   */
  async disconnectAthleteFromCoach(coachId: string, athleteUserId: string): Promise<void> {
    try {
      const athleteMemberships = (await pulseCheckProvisioningService.listUserTeamMemberships(athleteUserId)).filter(
        (membership) =>
          membership.role === 'athlete' &&
          membership.legacySource === 'coach-athletes' &&
          membership.legacyCoachId === coachId
      );

      await Promise.all(
        athleteMemberships.map((membership) =>
          deleteDoc(doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, membership.id))
        )
      );
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
      const athleteMemberships = (await pulseCheckProvisioningService.listUserTeamMemberships(athleteUserId)).filter(
        (membership) => membership.role === 'athlete'
      );
      const activeCoachIds = new Set<string>();

      for (const athleteMembership of athleteMemberships) {
        const teamMemberships = await pulseCheckProvisioningService.listTeamMemberships(athleteMembership.teamId);
        teamMemberships
          .filter(
            (membership) =>
              DIRECT_COACH_ROLES.has(membership.role) &&
              membership.userId !== athleteUserId &&
              canCoachMembershipSeeAthlete(membership, athleteMembership)
          )
          .forEach((membership) => activeCoachIds.add(membership.userId));
      }

      const coachIds = Array.from(activeCoachIds);
      if (coachIds.length === 0) return [];
      const coachesRef = collection(db, 'coaches');
      const result: Array<{ id: string; data: CoachFirestoreData }> = [];
      for (const coachId of coachIds) {
        const cDoc = await getDoc(doc(coachesRef, coachId));
        if (cDoc.exists()) result.push({ id: cDoc.id, data: cDoc.data() as CoachFirestoreData });
      }
      return result;
    } catch (error) {
      console.error('Error getting connected coaches:', error);
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
      const { organizationId, teamId } = await this.ensureCoachOperatingContext(coachId);
      await setDoc(
        doc(db, PULSECHECK_TEAM_MEMBERSHIPS_COLLECTION, `${teamId}_${athleteUserId}`),
        {
          organizationId,
          teamId,
          userId: athleteUserId,
          role: 'athlete',
          permissionSetId: 'pulsecheck-athlete-v1',
          rosterVisibilityScope: 'none',
          allowedAthleteIds: [],
          legacySource: 'coach-athletes',
          legacyCoachId: coachId,
          athleteOnboarding: defaultPulseCheckAthleteOnboarding(),
          onboardingStatus: 'pending-consent',
          grantedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const privacyRef = doc(db, 'athlete-privacy-settings', athleteUserId, 'coaches', coachId);
      await setDoc(privacyRef, {
        athleteUserId,
        coachId,
        shareConversations: true,
        shareSentiment: true,
        shareActivity: true,
        consentGivenAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
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
      const connections = await this.listPulseCheckAthleteConnectionsForCoach(coachId);
      return connections.map((entry) => entry.athleteMembership.userId);
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
      const connections = await this.listPulseCheckAthleteConnectionsForCoach(coachId);
      console.log(`[CoachService] Found ${connections.length} PulseCheck athlete memberships for coach`);

      const athletes = [];
      for (const connection of connections) {
        const athleteUserId = connection.athleteMembership.userId;

        // Fetch user profile for each athlete
        const userRef = doc(db, 'users', athleteUserId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Get additional stats (conversations, sessions, etc.)
          // Defensive: ensure we have a valid instance context; fallback to singleton
          const self = (this as CoachService | undefined) || coachService;
          const athleteStats = await self.getAthleteStats(athleteUserId);

          // Last active should prioritize most recent conversation; fallback to PulseCheck membership timestamps.
          const conversationDate = athleteStats.lastConversationDate;
          const linkUpdated = convertFirestoreTimestamp(
            connection.athleteMembership.updatedAt || connection.athleteMembership.grantedAt || connection.athleteMembership.createdAt
          );
          const lastActive = conversationDate && !isNaN(conversationDate.getTime())
            ? conversationDate
            : linkUpdated;
          
          athletes.push({
            id: athleteUserId,
            displayName: userData.displayName || userData.username || 'Unknown User',
            email: userData.email || '',
            profileImageUrl: userData.profileImageUrl,
            linkedAt: connection.linkedAt,
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
          } catch (_collectionError) {
            // Collection might not exist, continue to next one
            continue;
          }
        }
      } catch (_workoutError) {
        console.log('[CoachService] No workout data found, using 0 sessions');
      }

      // 3. Calculate weekly goal progress: Track Nora check-ins (7 conversations per week)
      let weeklyGoalProgress = 0;
      try {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        weekStart.setHours(0, 0, 0, 0);
        
        // Get all conversations for this user
        const conversationsRef = collection(db, 'conversations');
        const conversationQuery = query(conversationsRef, where('userId', '==', athleteUserId));
        const conversationSnapshot = await getDocs(conversationQuery);
        
        // Count unique days with conversations this week
        const checkInDates = new Set<string>();
        conversationSnapshot.docs.forEach(doc => {
          const conversationData = doc.data();
          const conversationDate = convertFirestoreTimestamp(conversationData.createdAt || conversationData.updatedAt);
          
          // Check if conversation is within this week
          if (conversationDate >= weekStart) {
            const dateStr = conversationDate.toISOString().split('T')[0]; // YYYY-MM-DD
            checkInDates.add(dateStr);
          }
        });
        
        const checkInsThisWeek = checkInDates.size;
        const targetCheckIns = 7; // Daily check-ins with Nora
        weeklyGoalProgress = Math.min(100, Math.round((checkInsThisWeek / targetCheckIns) * 100));
        
        console.log(`[CoachService] Weekly goal: ${checkInsThisWeek}/${targetCheckIns} check-ins = ${weeklyGoalProgress}%`);
      } catch (weeklyGoalError) {
        console.log('[CoachService] Error calculating weekly goal progress:', weeklyGoalError);
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
   * Public method for accessing message content for coach tooltips
   */
  async getMessagesForDate(userId: string, dateString: string): Promise<string[]> {
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

      await this.linkAthleteToCoach(coachId, mockUserId);

      console.log(`[CoachService] Created mock athlete: ${athleteName} (${mockUserId})`);
    } catch (error) {
      console.error('[CoachService] Error creating mock athlete:', error);
      throw error;
    }
  }
}

export const coachService = new CoachService();
