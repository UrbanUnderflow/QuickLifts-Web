import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
  arrayUnion,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config';
import {
  Club,
  ClubActivationResponse,
  ClubEvent,
  ClubMember,
  ClubMemberProfile,
  ClubPairing,
  ClubPairingSuggestion,
  ClubSafetyReport,
  ClubSafetyReportCategory,
} from './types';
import { ShortUser, userService } from '../user';
import { workoutService } from '../workout/service';
import { dateToUnixTimestamp } from '../../../utils/formatDate';

class ClubService {
  private clubsCollection = collection(db, 'clubs');
  private clubMembersCollection = collection(db, 'clubMembers');
  private clubMemberProfilesCollection = collection(db, 'clubMemberProfiles');
  private clubPairingsCollection = collection(db, 'clubPairings');
  private clubSafetyReportsCollection = collection(db, 'clubSafetyReports');

  // MARK: - Club CRUD Operations

  /**
   * Creates a new club for a creator
   */
  async createClub(
    creatorId: string,
    creatorInfo: ShortUser,
    name: string,
    description: string,
    coverImageURL?: string,
    linkedRoundIds: string[] = []
  ): Promise<Club> {
    const clubRef = doc(this.clubsCollection);
    const now = new Date();

    const club = new Club({
      id: clubRef.id,
      creatorId,
      creatorInfo: creatorInfo.toDictionary(),
      name,
      description,
      coverImageURL,
      memberCount: 0, // Creator is automatically a member (incremented via joinClub)
      linkedRoundIds,
      createdAt: dateToUnixTimestamp(now),
      updatedAt: dateToUnixTimestamp(now)
    });

    await setDoc(clubRef, club.toDictionary());
    console.log(`[ClubService] Created club: ${club.id} for creator: ${creatorId}`);

    // Add the creator as the first member
    await this.joinClub(club.id, creatorId, creatorInfo, 'creator');

    return club;
  }

  /**
   * Fetches a club by its ID
   */
  async getClubById(clubId: string): Promise<Club | null> {
    const clubRef = doc(this.clubsCollection, clubId);
    const snapshot = await getDoc(clubRef);

    if (!snapshot.exists()) {
      return null;
    }

    return new Club({ id: snapshot.id, ...snapshot.data() });
  }

  /**
   * Fetches a club by creator ID (since each creator has one club)
   */
  async getClubByCreatorId(creatorId: string): Promise<Club | null> {
    const q = query(
      this.clubsCollection,
      where('creatorId', '==', creatorId),
      limit(1)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return new Club({ id: doc.id, ...doc.data() });
  }

  /**
   * Fetches all clubs by creator ID (supports multiple clubs per creator)
   */
  async getClubsByCreatorId(creatorId: string): Promise<Club[]> {
    const q = query(
      this.clubsCollection,
      where('creatorId', '==', creatorId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map(doc => new Club({ id: doc.id, ...doc.data() }));
  }

  /**
   * Updates an existing club
   */
  async updateClub(club: Club): Promise<void> {
    const clubRef = doc(this.clubsCollection, club.id);
    club.updatedAt = new Date();
    await updateDoc(clubRef, club.toDictionary());
    console.log(`[ClubService] Updated club: ${club.id}`);
  }

  /**
   * Adds a round ID to the club's linkedRoundIds
   */
  async linkRoundToClub(clubId: string, roundId: string): Promise<void> {
    const clubRef = doc(this.clubsCollection, clubId);
    await updateDoc(clubRef, {
      linkedRoundIds: arrayUnion(roundId),
      updatedAt: dateToUnixTimestamp(new Date())
    });
    console.log(`[ClubService] Linked round ${roundId} to club ${clubId}`);
  }

  // MARK: - Club Member Operations

  /**
   * Adds a user to a club
   */
  async joinClub(
    clubId: string,
    userId: string,
    userInfo: ShortUser,
    joinedVia: string
  ): Promise<ClubMember> {
    const memberId = ClubMember.generateMemberId(clubId, userId);
    const memberRef = doc(this.clubMembersCollection, memberId);

    // Check if member already exists
    const existingSnapshot = await getDoc(memberRef);

    if (existingSnapshot.exists()) {
      const existingData = existingSnapshot.data();
      if (existingData?.isActive === false) {
        // Reactivate the member
        await updateDoc(memberRef, {
          isActive: true,
          joinedVia
        });
        console.log(`[ClubService] Reactivated member ${userId} in club ${clubId}`);

        // Increment member count since they rejoined
        const clubRef = doc(this.clubsCollection, clubId);
        await updateDoc(clubRef, {
          memberCount: increment(1)
        });
      } else {
        console.log(`[ClubService] User ${userId} is already a member of club ${clubId}`);
      }
      return new ClubMember({ id: memberId, ...existingData, isActive: true });
    }

    // Create new member
    const member = new ClubMember({
      id: memberId,
      clubId,
      userId,
      userInfo: userInfo.toDictionary(),
      joinedVia,
      joinedAt: dateToUnixTimestamp(new Date()),
      isActive: true
    });

    await setDoc(memberRef, member.toDictionary());
    console.log(`[ClubService] Added member ${userId} to club ${clubId}`);

    // Increment member count
    const clubRef = doc(this.clubsCollection, clubId);
    await updateDoc(clubRef, {
      memberCount: increment(1)
    });

    return member;
  }

  /**
   * Removes a user from a club (sets isActive to false)
   */
  async leaveClub(clubId: string, userId: string): Promise<void> {
    const memberId = ClubMember.generateMemberId(clubId, userId);
    const memberRef = doc(this.clubMembersCollection, memberId);

    await updateDoc(memberRef, {
      isActive: false
    });

    // Decrement member count
    const clubRef = doc(this.clubsCollection, clubId);
    await updateDoc(clubRef, {
      memberCount: increment(-1)
    });

    console.log(`[ClubService] User ${userId} left club ${clubId}`);
  }

  /**
   * Syncs the member count for a club to a specific value
   */
  async syncMemberCount(clubId: string, count: number): Promise<void> {
    const clubRef = doc(this.clubsCollection, clubId);
    await updateDoc(clubRef, {
      memberCount: count
    });
    console.log(`[ClubService] Synced member count to ${count} for club ${clubId}`);
  }

  /**
   * Fetches all active members of a club
   */
  async getClubMembers(clubId: string): Promise<ClubMember[]> {
    const q = query(
      this.clubMembersCollection,
      where('clubId', '==', clubId),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => new ClubMember({ id: doc.id, ...doc.data() }));
  }

  async getClubMember(clubId: string, userId: string): Promise<ClubMember | null> {
    const memberId = ClubMember.generateMemberId(clubId, userId);
    const snapshot = await getDoc(doc(this.clubMembersCollection, memberId));

    if (!snapshot.exists()) {
      return null;
    }

    return new ClubMember({ id: snapshot.id, ...snapshot.data() });
  }

  async getClubMemberProfile(clubId: string, userId: string): Promise<ClubMemberProfile | null> {
    const profileId = ClubMemberProfile.generateProfileId(clubId, userId);
    const snapshot = await getDoc(doc(this.clubMemberProfilesCollection, profileId));

    if (!snapshot.exists()) {
      return null;
    }

    return new ClubMemberProfile({ id: snapshot.id, ...snapshot.data() });
  }

  async getClubMemberProfiles(clubId: string): Promise<ClubMemberProfile[]> {
    const q = query(this.clubMemberProfilesCollection, where('clubId', '==', clubId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((profileDoc) => new ClubMemberProfile({ id: profileDoc.id, ...profileDoc.data() }));
  }

  async saveClubMemberProfile(profile: ClubMemberProfile): Promise<void> {
    const profileRef = doc(this.clubMemberProfilesCollection, profile.id);
    await setDoc(profileRef, profile.toDictionary(), { merge: true });
  }

  async updateClubMemberPairingPreferences(args: {
    clubId: string;
    userId: string;
    pairingOptIn?: boolean;
    doNotPairUserIds?: string[];
  }): Promise<ClubMemberProfile> {
    const existingProfile = await this.getOrCreateClubMemberProfile(args.clubId, args.userId);
    const updatedProfile = new ClubMemberProfile({
      ...existingProfile.toDictionary(),
      pairingOptIn: args.pairingOptIn ?? existingProfile.pairingOptIn,
      doNotPairUserIds: args.doNotPairUserIds ?? existingProfile.doNotPairUserIds,
      updatedAt: new Date(),
    });

    await this.saveClubMemberProfile(updatedProfile);
    return updatedProfile;
  }

  async requestClubMemberRematch(
    clubId: string,
    userId: string,
    reason: string
  ): Promise<ClubMemberProfile> {
    const existingProfile = await this.getOrCreateClubMemberProfile(clubId, userId);
    const updatedProfile = new ClubMemberProfile({
      ...existingProfile.toDictionary(),
      rematchRequestedAt: new Date(),
      rematchReason: reason.trim(),
      updatedAt: new Date(),
    });

    await this.saveClubMemberProfile(updatedProfile);
    return updatedProfile;
  }

  async clearClubMemberRematch(clubId: string, userId: string): Promise<ClubMemberProfile> {
    const existingProfile = await this.getOrCreateClubMemberProfile(clubId, userId);
    const updatedProfile = new ClubMemberProfile({
      ...existingProfile.toDictionary(),
      rematchRequestedAt: undefined,
      rematchReason: undefined,
      updatedAt: new Date(),
    });

    await setDoc(
      doc(this.clubMemberProfilesCollection, updatedProfile.id),
      {
        rematchRequestedAt: deleteField(),
        rematchReason: deleteField(),
        updatedAt: dateToUnixTimestamp(updatedProfile.updatedAt),
      },
      { merge: true }
    );
    return updatedProfile;
  }

  async completeClubMemberOnboarding(
    clubId: string,
    userId: string,
    responses: Record<string, ClubActivationResponse>
  ): Promise<ClubMemberProfile> {
    const now = new Date();
    const existingProfile = await this.getClubMemberProfile(clubId, userId);
    const mergedResponses = {
      ...(existingProfile?.responses || {}),
      ...responses,
    };

    const profile = new ClubMemberProfile({
      id: ClubMemberProfile.generateProfileId(clubId, userId),
      clubId,
      userId,
      responses: Object.entries(mergedResponses).reduce<Record<string, any>>((accumulator, [questionId, response]) => {
        accumulator[questionId] = response.toDictionary();
        return accumulator;
      }, {}),
      completedQuestionIds: Object.keys(mergedResponses),
      completedAt: now,
      updatedAt: now,
    });

    await Promise.all([
      this.saveClubMemberProfile(profile),
      updateDoc(doc(this.clubMembersCollection, ClubMember.generateMemberId(clubId, userId)), {
        onboardedAt: dateToUnixTimestamp(now),
      }),
    ]);

    return profile;
  }

  async markClubMemberIntroduced(clubId: string, userId: string): Promise<void> {
    await updateDoc(doc(this.clubMembersCollection, ClubMember.generateMemberId(clubId, userId)), {
      introducedAt: dateToUnixTimestamp(new Date()),
    });
  }

  async getClubPairings(clubId: string): Promise<ClubPairing[]> {
    const q = query(this.clubPairingsCollection, where('clubId', '==', clubId));

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((pairingDoc) => new ClubPairing({ id: pairingDoc.id, ...pairingDoc.data() }))
      .filter((pairing) => pairing.isActive);
  }

  async getClubSafetyReports(clubId: string): Promise<ClubSafetyReport[]> {
    const q = query(this.clubSafetyReportsCollection, where('clubId', '==', clubId));
    const snapshot = await getDocs(q);

    return snapshot.docs
      .map((reportDoc) => new ClubSafetyReport({ id: reportDoc.id, ...reportDoc.data() }))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async submitClubSafetyReport(args: {
    clubId: string;
    reporterUserId: string;
    reportedUserId?: string;
    pairingId?: string;
    category: ClubSafetyReportCategory;
    details: string;
  }): Promise<ClubSafetyReport> {
    const reportRef = doc(this.clubSafetyReportsCollection);
    const now = new Date();
    const report = new ClubSafetyReport({
      id: reportRef.id,
      clubId: args.clubId,
      reporterUserId: args.reporterUserId,
      reportedUserId: args.reportedUserId,
      pairingId: args.pairingId,
      category: args.category,
      details: args.details.trim(),
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });

    await setDoc(reportRef, report.toDictionary());
    return report;
  }

  async resolveClubSafetyReport(clubId: string, reportId: string): Promise<void> {
    await updateDoc(doc(this.clubSafetyReportsCollection, reportId), {
      clubId,
      status: 'resolved',
      resolvedAt: dateToUnixTimestamp(new Date()),
      updatedAt: dateToUnixTimestamp(new Date()),
    });
  }

  async upsertClubPairing(args: {
    clubId: string;
    memberUserIds: string[];
    createdByUserId: string;
    source: 'manual' | 'assisted';
    score?: number;
    reasons?: string[];
  }): Promise<ClubPairing> {
    const sortedUserIds = [...new Set(args.memberUserIds)].sort();

    if (sortedUserIds.length !== 2) {
      throw new Error('A pairing must include exactly two unique members.');
    }

    const now = new Date();
    const pairingId = ClubPairing.generatePairingId(args.clubId, sortedUserIds);
    const existingPairings = await this.getClubPairings(args.clubId);
    const memberProfiles = await Promise.all(
      sortedUserIds.map((memberUserId) => this.getOrCreateClubMemberProfile(args.clubId, memberUserId))
    );
    const conflictingPairings = existingPairings.filter((pairing) =>
      pairing.memberUserIds.some((memberUserId) => sortedUserIds.includes(memberUserId))
    );

    if (memberProfiles.some((profile) => !profile.pairingOptIn)) {
      throw new Error('One or more members have opted out of pairing.');
    }

    if (this.hasPairingBlock(memberProfiles[0], memberProfiles[1])) {
      throw new Error('These members have a do-not-pair restriction.');
    }

    const batch = writeBatch(db);
    const membersToClear = new Set<string>();

    conflictingPairings.forEach((pairing) => {
      if (pairing.id !== pairingId) {
        batch.set(doc(this.clubPairingsCollection, pairing.id), {
          isActive: false,
          updatedAt: dateToUnixTimestamp(now),
        }, { merge: true });

        pairing.memberUserIds.forEach((memberUserId) => {
          if (!sortedUserIds.includes(memberUserId)) {
            membersToClear.add(memberUserId);
          }
        });
      }
    });

    sortedUserIds.forEach((memberUserId) => {
      membersToClear.delete(memberUserId);
    });

    const pairing = new ClubPairing({
      id: pairingId,
      clubId: args.clubId,
      memberUserIds: sortedUserIds,
      source: args.source,
      score: args.score,
      reasons: args.reasons || [],
      createdByUserId: args.createdByUserId,
      createdAt: now,
      updatedAt: now,
      isActive: true,
    });

    batch.set(doc(this.clubPairingsCollection, pairing.id), pairing.toDictionary(), { merge: true });

    sortedUserIds.forEach((memberUserId) => {
      batch.set(doc(this.clubMembersCollection, ClubMember.generateMemberId(args.clubId, memberUserId)), {
        pairedAt: dateToUnixTimestamp(now),
      }, { merge: true });
      batch.set(doc(this.clubMemberProfilesCollection, ClubMemberProfile.generateProfileId(args.clubId, memberUserId)), {
        rematchRequestedAt: deleteField(),
        rematchReason: deleteField(),
        updatedAt: dateToUnixTimestamp(now),
      }, { merge: true });
    });

    membersToClear.forEach((memberUserId) => {
      batch.update(doc(this.clubMembersCollection, ClubMember.generateMemberId(args.clubId, memberUserId)), {
        pairedAt: deleteField(),
      });
    });

    await batch.commit();
    return pairing;
  }

  async removeClubPairing(clubId: string, pairingId: string): Promise<void> {
    const pairingRef = doc(this.clubPairingsCollection, pairingId);
    const snapshot = await getDoc(pairingRef);

    if (!snapshot.exists()) {
      return;
    }

    const pairing = new ClubPairing({ id: snapshot.id, ...snapshot.data() });
    const batch = writeBatch(db);

    batch.set(pairingRef, {
      isActive: false,
      updatedAt: dateToUnixTimestamp(new Date()),
    }, { merge: true });

    pairing.memberUserIds.forEach((memberUserId) => {
      batch.update(doc(this.clubMembersCollection, ClubMember.generateMemberId(clubId, memberUserId)), {
        pairedAt: deleteField(),
      });
    });

    await batch.commit();
  }

  async suggestClubPairings(clubId: string): Promise<ClubPairingSuggestion[]> {
    const [club, members, profiles, activePairings] = await Promise.all([
      this.getClubById(clubId),
      this.getClubMembers(clubId),
      this.getClubMemberProfiles(clubId),
      this.getClubPairings(clubId),
    ]);

    if (!club || !club.activation.matchingEnabled) {
      return [];
    }

    const pairedUserIds = new Set(activePairings.flatMap((pairing) => pairing.memberUserIds));
    const profileMap = profiles.reduce<Record<string, ClubMemberProfile>>((accumulator, profile) => {
      accumulator[profile.userId] = profile;
      return accumulator;
    }, {});

    const eligibleMembers = members.filter((member) => {
      if (member.userId === club.creatorId) return false;
      if (!member.onboardedAt) return false;
      if (club.activation.introRequired && !member.introducedAt) return false;
      if (pairedUserIds.has(member.userId)) return false;
      const profile = profileMap[member.userId];
      return Boolean(profile && profile.pairingOptIn);
    });

    const candidates: ClubPairingSuggestion[] = [];

    for (let index = 0; index < eligibleMembers.length; index += 1) {
      for (let comparisonIndex = index + 1; comparisonIndex < eligibleMembers.length; comparisonIndex += 1) {
        const leftMember = eligibleMembers[index];
        const rightMember = eligibleMembers[comparisonIndex];
        const suggestion = this.buildPairingSuggestion(
          clubId,
          leftMember.userId,
          rightMember.userId,
          profileMap[leftMember.userId],
          profileMap[rightMember.userId]
        );

        if (suggestion) {
          candidates.push(suggestion);
        }
      }
    }

    candidates.sort((left, right) => right.score - left.score);

    const usedMemberIds = new Set<string>();
    const finalSuggestions: ClubPairingSuggestion[] = [];

    for (const candidate of candidates) {
      if (candidate.memberUserIds.some((memberUserId) => usedMemberIds.has(memberUserId))) {
        continue;
      }

      finalSuggestions.push(candidate);
      candidate.memberUserIds.forEach((memberUserId) => usedMemberIds.add(memberUserId));
    }

    return finalSuggestions;
  }

  /**
   * Fetches all club events for a club, sorted to match iOS.
   */
  async getClubEvents(clubId: string): Promise<ClubEvent[]> {
    const snapshot = await getDocs(collection(db, 'clubEventCheckins', clubId, 'events'));

    return snapshot.docs
      .map(doc => new ClubEvent({ id: doc.id, ...doc.data() }))
      .sort((left, right) => {
        if (left.isUpcoming !== right.isUpcoming) {
          return left.isUpcoming ? -1 : 1;
        }

        return left.startDate.getTime() - right.startDate.getTime();
      });
  }

  /**
   * Fetches all check-in documents for a specific event.
   */
  async getEventCheckins(clubId: string, eventId: string): Promise<any[]> {
    const snapshot = await getDocs(
      collection(db, 'clubEventCheckins', clubId, 'events', eventId, 'checkins')
    );
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Fetches check-in counts for all events in a club.
   * Returns a map of eventId → attendee list.
   */
  async getAllEventCheckins(clubId: string, eventIds: string[]): Promise<Record<string, any[]>> {
    const result: Record<string, any[]> = {};
    await Promise.all(
      eventIds.map(async (eventId) => {
        result[eventId] = await this.getEventCheckins(clubId, eventId);
      })
    );
    return result;
  }

  /**
   * Returns the sum of completed workouts by all active club members.
   * Uses each user's workoutCount when present; falls back to subcollection count for users without it (e.g. before backfill).
   */
  async getTotalWorkoutsCompletedByMembers(clubId: string): Promise<number> {
    const members = await this.getClubMembers(clubId);
    if (members.length === 0) return 0;
    const userIds = members.map((m) => m.userId);
    const counts = await userService.getWorkoutCounts(userIds);
    const withFallback = { ...counts };
    await Promise.all(
      userIds.map(async (uid) => {
        if (withFallback[uid] === undefined || withFallback[uid] === 0) {
          const subCount = await workoutService.getWorkoutSummaryCount(uid);
          if (subCount > 0) withFallback[uid] = subCount;
        }
      })
    );
    return Object.values(withFallback).reduce((a, b) => a + b, 0);
  }

  /**
   * Fetches all clubs that a user is a member of
   */
  async getClubsForUser(userId: string): Promise<Club[]> {
    const q = query(
      this.clubMembersCollection,
      where('userId', '==', userId),
      where('isActive', '==', true)
    );

    const membershipSnapshot = await getDocs(q);
    const clubIds = membershipSnapshot.docs.map(doc => doc.data().clubId as string);

    if (clubIds.length === 0) {
      return [];
    }

    const clubs: Club[] = [];
    for (const clubId of clubIds) {
      const club = await this.getClubById(clubId);
      if (club) {
        clubs.push(club);
      }
    }

    return clubs;
  }

  /**
   * Checks if a user is a member of a specific club
   */
  async isUserMember(clubId: string, userId: string): Promise<boolean> {
    const memberId = ClubMember.generateMemberId(clubId, userId);
    const memberRef = doc(this.clubMembersCollection, memberId);
    const snapshot = await getDoc(memberRef);

    if (!snapshot.exists()) {
      return false;
    }

    return snapshot.data()?.isActive === true;
  }

  // MARK: - Helper Methods

  /**
   * Gets existing club or creates a new one for a creator
   */
  async getOrCreateClub(
    user: { id: string; displayName: string; email: string; username: string; level: string; profileImage: any; fcmToken?: string; videoCount?: number; isFoundingTrainer?: boolean },
    roundId?: string
  ): Promise<Club> {
    const existingClub = await this.getClubByCreatorId(user.id);

    if (existingClub) {
      // Club exists, link the round if provided
      if (roundId) {
        await this.linkRoundToClub(existingClub.id, roundId);
      }
      return existingClub;
    }

    // No club exists, create one
    const shortUser = new ShortUser({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      fcmToken: user.fcmToken || '',
      username: user.username,
      level: user.level,
      videoCount: user.videoCount || 0,
      profileImage: user.profileImage,
      isFoundingTrainer: user.isFoundingTrainer || false
    });

    const clubName = `${user.displayName}'s Club`;
    const clubDescription = 'Welcome to my community! Join rounds, chat, and grow together.';

    return this.createClub(
      user.id,
      shortUser,
      clubName,
      clubDescription,
      undefined,
      roundId ? [roundId] : []
    );
  }

  // MARK: - Backfill Logic

  /**
   * Backfills members from existing rounds when a club is manually created
   */
  async backfillMembersFromExistingRounds(
    clubId: string,
    creatorId: string,
    roundIds: string[],
    participants: Array<{ id: string; username: string; profileImage: any }>
  ): Promise<number> {
    console.log(`[ClubService] Starting backfill for club ${clubId} with ${participants.length} participants`);

    if (participants.length === 0) {
      return 0;
    }

    // Deduplicate by user ID and exclude creator
    const uniqueParticipants = new Map<string, { id: string; username: string; profileImage: any }>();
    for (const participant of participants) {
      if (participant.id !== creatorId && !uniqueParticipants.has(participant.id)) {
        uniqueParticipants.set(participant.id, participant);
      }
    }

    const participantsToAdd = Array.from(uniqueParticipants.values());
    console.log(`[ClubService] ${participantsToAdd.length} unique participants to backfill`);

    // Process in batches of 450 (Firestore limit is 500)
    const BATCH_SIZE = 450;
    let addedCount = 0;

    for (let i = 0; i < participantsToAdd.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = participantsToAdd.slice(i, i + BATCH_SIZE);

      for (const participant of chunk) {
        const member = new ClubMember({
          clubId,
          userId: participant.id,
          userInfo: {
            id: participant.id,
            displayName: participant.username,
            email: '',
            username: participant.username,
            level: 'novice',
            profileImage: participant.profileImage || { profileImageURL: '', imageOffsetWidth: 0, imageOffsetHeight: 0 }
          },
          joinedVia: 'backfill',
          joinedAt: dateToUnixTimestamp(new Date()),
          isActive: true
        });

        const memberRef = doc(this.clubMembersCollection, member.id);
        batch.set(memberRef, member.toDictionary(), { merge: true });
        addedCount++;
      }

      await batch.commit();
      console.log(`[ClubService] Committed batch ${Math.floor(i / BATCH_SIZE) + 1}`);
    }

    // Update club member count and linked round IDs
    const clubRef = doc(this.clubsCollection, clubId);
    await updateDoc(clubRef, {
      memberCount: increment(addedCount),
      linkedRoundIds: arrayUnion(...roundIds)
    });

    console.log(`[ClubService] Backfill complete: added ${addedCount} members to club ${clubId}`);
    return addedCount;
  }

  private buildPairingSuggestion(
    clubId: string,
    leftUserId: string,
    rightUserId: string,
    leftProfile: ClubMemberProfile,
    rightProfile: ClubMemberProfile
  ): ClubPairingSuggestion | null {
    if (this.hasPairingBlock(leftProfile, rightProfile)) {
      return null;
    }

    let score = 0;
    const reasons: string[] = [];

    const primaryGoalMatch = this.hasMatchingSelections(leftProfile, rightProfile, 'primary_goal');
    if (primaryGoalMatch) {
      score += 4;
      reasons.push('Shared primary goal');
    }

    const availabilityOverlap = this.countSharedSelections(leftProfile, rightProfile, 'weekly_availability');
    if (availabilityOverlap > 0) {
      score += Math.min(availabilityOverlap, 2) * 3;
      reasons.push('Schedule overlap');
    }

    if (this.hasMatchingSelections(leftProfile, rightProfile, 'preferred_workout_type')) {
      score += 2;
      reasons.push('Similar workout preference');
    }

    if (this.hasMatchingSelections(leftProfile, rightProfile, 'fitness_level')) {
      score += 2;
      reasons.push('Comparable fitness level');
    }

    if (this.hasMatchingSelections(leftProfile, rightProfile, 'accountability_style')) {
      score += 3;
      reasons.push('Compatible accountability style');
    }

    if (this.hasMatchingText(leftProfile, rightProfile, 'location_neighborhood')) {
      score += 1;
      reasons.push('Same neighborhood');
    }

    if (score < 3) {
      return null;
    }

    const memberUserIds = [leftUserId, rightUserId].sort();

    return {
      id: ClubPairing.generatePairingId(clubId, memberUserIds),
      clubId,
      memberUserIds,
      score,
      reasons,
    };
  }

  private hasMatchingSelections(
    leftProfile: ClubMemberProfile,
    rightProfile: ClubMemberProfile,
    questionId: string
  ): boolean {
    return this.countSharedSelections(leftProfile, rightProfile, questionId) > 0;
  }

  private countSharedSelections(
    leftProfile: ClubMemberProfile,
    rightProfile: ClubMemberProfile,
    questionId: string
  ): number {
    const leftSelections = leftProfile.responses[questionId]?.selectedOptionIds || [];
    const rightSelections = new Set(rightProfile.responses[questionId]?.selectedOptionIds || []);

    return leftSelections.filter((selectionId) => rightSelections.has(selectionId)).length;
  }

  private hasMatchingText(
    leftProfile: ClubMemberProfile,
    rightProfile: ClubMemberProfile,
    questionId: string
  ): boolean {
    const leftValue = leftProfile.responses[questionId]?.textValue?.trim().toLowerCase();
    const rightValue = rightProfile.responses[questionId]?.textValue?.trim().toLowerCase();

    if (!leftValue || !rightValue) {
      return false;
    }

    return leftValue === rightValue;
  }

  private hasPairingBlock(leftProfile: ClubMemberProfile, rightProfile: ClubMemberProfile): boolean {
    return (
      leftProfile.doNotPairUserIds.includes(rightProfile.userId) ||
      rightProfile.doNotPairUserIds.includes(leftProfile.userId)
    );
  }

  private async getOrCreateClubMemberProfile(clubId: string, userId: string): Promise<ClubMemberProfile> {
    const existingProfile = await this.getClubMemberProfile(clubId, userId);

    if (existingProfile) {
      return existingProfile;
    }

    const profile = new ClubMemberProfile({
      clubId,
      userId,
      responses: {},
      completedQuestionIds: [],
      pairingOptIn: true,
      doNotPairUserIds: [],
      updatedAt: new Date(),
    });

    await this.saveClubMemberProfile(profile);
    return profile;
  }
}

export const clubService = new ClubService();
