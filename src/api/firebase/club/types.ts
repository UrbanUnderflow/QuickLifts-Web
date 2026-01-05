import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../../../utils/formatDate';
import { ShortUser } from '../user';

/**
 * Represents a Creator Club - a persistent community space for a creator's followers
 */
export class Club {
  id: string;
  creatorId: string;
  creatorInfo: ShortUser;
  name: string;
  description: string;
  coverImageURL?: string;
  memberCount: number;
  linkedRoundIds: string[];
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
    this.id = data.id || '';
    this.creatorId = data.creatorId || '';
    this.name = data.name || '';
    this.description = data.description || '';
    this.coverImageURL = data.coverImageURL || undefined;
    this.memberCount = data.memberCount || 0;
    this.linkedRoundIds = data.linkedRoundIds || [];
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);

    // Parse creatorInfo
    if (data.creatorInfo) {
      this.creatorInfo = new ShortUser(data.creatorInfo);
    } else {
      this.creatorInfo = new ShortUser({
        id: this.creatorId,
        displayName: '',
        email: '',
        username: '',
        level: 'novice',
        profileImage: { profileImageURL: '', imageOffsetWidth: 0, imageOffsetHeight: 0 }
      });
    }
  }

  toDictionary(): { [key: string]: any } {
    const dict: { [key: string]: any } = {
      id: this.id,
      creatorId: this.creatorId,
      creatorInfo: this.creatorInfo.toDictionary(),
      name: this.name,
      description: this.description,
      memberCount: this.memberCount,
      linkedRoundIds: this.linkedRoundIds,
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt)
    };

    if (this.coverImageURL) {
      dict.coverImageURL = this.coverImageURL;
    }

    return dict;
  }
}

/**
 * Represents a member of a Creator Club
 */
export class ClubMember {
  id: string; // Format: "{clubId}_{userId}"
  clubId: string;
  userId: string;
  userInfo: ShortUser;
  joinedVia: string; // roundId, "manual", or "backfill"
  joinedAt: Date;
  isActive: boolean; // For opt-out tracking

  constructor(data: any) {
    this.clubId = data.clubId || '';
    this.userId = data.userId || '';
    this.id = data.id || ClubMember.generateMemberId(this.clubId, this.userId);
    this.joinedVia = data.joinedVia || 'unknown';
    this.joinedAt = convertFirestoreTimestamp(data.joinedAt);
    this.isActive = data.isActive !== false; // Default to true

    // Parse userInfo
    if (data.userInfo) {
      this.userInfo = new ShortUser(data.userInfo);
    } else {
      this.userInfo = new ShortUser({
        id: this.userId,
        displayName: '',
        email: '',
        username: '',
        level: 'novice',
        profileImage: { profileImageURL: '', imageOffsetWidth: 0, imageOffsetHeight: 0 }
      });
    }
  }

  toDictionary(): { [key: string]: any } {
    return {
      id: this.id,
      clubId: this.clubId,
      userId: this.userId,
      userInfo: this.userInfo.toDictionary(),
      joinedVia: this.joinedVia,
      joinedAt: dateToUnixTimestamp(this.joinedAt),
      isActive: this.isActive
    };
  }

  /**
   * Generates a consistent member ID from clubId and userId
   */
  static generateMemberId(clubId: string, userId: string): string {
    return `${clubId}_${userId}`;
  }
}
