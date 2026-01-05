import {
  collection,
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
import { Club, ClubMember } from './types';
import { ShortUser } from '../user';
import { dateToUnixTimestamp } from '../../../utils/formatDate';

class ClubService {
  private clubsCollection = collection(db, 'clubs');
  private clubMembersCollection = collection(db, 'clubMembers');

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
      memberCount: 1, // Creator is automatically a member
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
      } else {
        console.log(`[ClubService] User ${userId} is already a member of club ${clubId}`);
      }
      return new ClubMember({ id: memberId, ...existingSnapshot.data() });
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
}

export const clubService = new ClubService();
