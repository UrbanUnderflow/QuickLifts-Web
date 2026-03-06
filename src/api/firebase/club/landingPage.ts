import { workoutService } from '../workout/service';
import { clubService } from './service';
import { ClubFeatures } from './types';

export interface RoundPreview {
  id: string;
  title: string;
  subtitle: string;
  workoutCount: number;
  participantCount: number;
  isActive: boolean;
}

export interface ClubLandingPageProps {
  clubData?: any | null;
  creatorData?: any | null;
  totalWorkoutsCompleted?: number;
  allRounds?: RoundPreview[];
  error?: string | null;
}

export const fetchClubLandingPageProps = async ({
  clubId,
  res,
}: {
  clubId?: string;
  res?: { setHeader: (name: string, value: string) => void };
}): Promise<ClubLandingPageProps> => {
  try {
    if (!clubId) {
      return { error: 'Club ID is required' };
    }

    res?.setHeader(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=59'
    );

    const club = await clubService.getClubById(clubId);
    console.log(`[ClubLanding] Fetched club id=${clubId}, raw memberCount from Firestore: ${club?.memberCount}`);

    if (!club) {
      return { error: 'Club not found' };
    }

    try {
      const actualMembers = await clubService.getClubMembers(club.id);
      console.log(`[ClubLanding] Actual active members in clubMembers collection: ${actualMembers.length}`);
      actualMembers.forEach((member, index) => {
        console.log(
          `[ClubLanding]   member[${index}]: userId=${member.userId}, joinedVia=${member.joinedVia}, isActive=${member.isActive}`
        );
      });
      console.log(
        `[ClubLanding] MISMATCH CHECK: stored memberCount=${club.memberCount} vs actual members=${actualMembers.length}`
      );
    } catch (error) {
      console.error('[ClubLanding] Error fetching actual members for debug:', error);
    }

    const clubData = {
      id: club.id,
      name: club.name || '',
      description: club.description || '',
      coverImageURL: club.coverImageURL || null,
      logoURL: club.logoURL || null,
      creatorId: club.creatorId || '',
      creatorInfo: club.creatorInfo ? club.creatorInfo.toDictionary() : null,
      memberCount: club.memberCount || 1,
      accentColor: club.accentColor || null,
      secondaryColor: club.secondaryColor || null,
      pinnedRoundIds: club.pinnedRoundIds || [],
      features: club.features ? club.features.toDictionary() : new ClubFeatures().toDictionary(),
      tagline: club.tagline || null,
      clubType: club.clubType || null,
      landingPageConfig: club.landingPageConfig || null,
    };

    let totalWorkoutsCompleted = 0;
    let allRounds: RoundPreview[] = [];

    try {
      totalWorkoutsCompleted = await clubService.getTotalWorkoutsCompletedByMembers(club.id);
    } catch (error) {
      console.error('Error fetching total workouts for club:', error);
    }

    const allRoundIds = club.linkedRoundIds || [];
    if (allRoundIds.length > 0) {
      try {
        const collections = await Promise.all(
          allRoundIds.map((roundId: string) => workoutService.getCollectionById(roundId).catch(() => null))
        );
        const validCollections = collections.filter((collection): collection is any => collection !== null);

        const participantCounts = await Promise.all(
          validCollections.map((collection) =>
            workoutService
              .fetchUserChallengesByChallengeId(collection.id)
              .then((userChallenges) => userChallenges.length)
              .catch(() => 0)
          )
        );

        const now = new Date();
        allRounds = validCollections
          .map((collection, index) => {
            const challenge = collection.challenge;
            const endDate = challenge?.endDate ? new Date(challenge.endDate) : null;

            return {
              id: collection.id,
              title: collection.title || challenge?.title || 'Round',
              subtitle: collection.subtitle || challenge?.subtitle || '',
              workoutCount: collection.sweatlistIds?.length ?? 0,
              participantCount: participantCounts[index],
              isActive: endDate ? now <= endDate : true,
            };
          })
          .sort((left, right) => {
            const leftScore = left.participantCount + left.workoutCount;
            const rightScore = right.participantCount + right.workoutCount;
            return rightScore - leftScore;
          });
      } catch (error) {
        console.error('Error fetching rounds for club:', error);
      }
    }

    const creatorInfo = club.creatorInfo;
    const creatorData = creatorInfo
      ? JSON.parse(JSON.stringify(creatorInfo.toDictionary ? creatorInfo.toDictionary() : creatorInfo))
      : null;

    return {
      clubData,
      creatorData,
      totalWorkoutsCompleted,
      allRounds,
    };
  } catch (error) {
    console.error('Error fetching club:', error);
    return {
      error: 'Failed to load club information',
    };
  }
};
