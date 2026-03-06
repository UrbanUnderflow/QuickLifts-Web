import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../../../utils/formatDate';
import { ShortUser } from '../user';

export class ClubFeatures {
  workoutLeaderboardEnabled: boolean;
  nutritionLeaderboardEnabled: boolean;
  nutritionMode: string;
  nutritionGoal: string;
  calorieAdjustment: number;
  dailyCalorieTarget?: number | null;
  proteinPercentage?: number | null;
  carbsPercentage?: number | null;
  fatPercentage?: number | null;

  constructor(data: any = {}) {
    this.workoutLeaderboardEnabled = data.workoutLeaderboardEnabled ?? false;
    this.nutritionLeaderboardEnabled = data.nutritionLeaderboardEnabled ?? false;
    this.nutritionMode = data.nutritionMode || 'fixed';
    this.nutritionGoal = data.nutritionGoal || 'maintain';
    this.calorieAdjustment = data.calorieAdjustment || 0;
    this.dailyCalorieTarget = data.dailyCalorieTarget ?? null;
    this.proteinPercentage = data.proteinPercentage ?? null;
    this.carbsPercentage = data.carbsPercentage ?? null;
    this.fatPercentage = data.fatPercentage ?? null;
  }

  toDictionary(): { [key: string]: any } {
    const dict: { [key: string]: any } = {
      workoutLeaderboardEnabled: this.workoutLeaderboardEnabled,
      nutritionLeaderboardEnabled: this.nutritionLeaderboardEnabled,
      nutritionMode: this.nutritionMode,
      nutritionGoal: this.nutritionGoal,
      calorieAdjustment: this.calorieAdjustment,
    };

    if (this.dailyCalorieTarget !== null && this.dailyCalorieTarget !== undefined) {
      dict.dailyCalorieTarget = this.dailyCalorieTarget;
    }

    if (this.proteinPercentage !== null && this.proteinPercentage !== undefined) {
      dict.proteinPercentage = this.proteinPercentage;
    }

    if (this.carbsPercentage !== null && this.carbsPercentage !== undefined) {
      dict.carbsPercentage = this.carbsPercentage;
    }

    if (this.fatPercentage !== null && this.fatPercentage !== undefined) {
      dict.fatPercentage = this.fatPercentage;
    }

    return dict;
  }
}

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
  logoURL?: string;
  memberCount: number;
  linkedRoundIds: string[];
  accentColor?: string;
  secondaryColor?: string;
  pinnedRoundIds: string[];
  features: ClubFeatures;
  tagline?: string;
  clubType?: string;
  createdAt: Date;
  updatedAt: Date;
  landingPageConfig?: any;

  constructor(data: any) {
    this.id = data.id || '';
    this.creatorId = data.creatorId || '';
    this.name = data.name || '';
    this.description = data.description || '';
    this.coverImageURL = data.coverImageURL || undefined;
    this.logoURL = data.logoURL || undefined;
    this.memberCount = data.memberCount || 0;
    this.linkedRoundIds = data.linkedRoundIds || [];
    this.accentColor = data.accentColor || undefined;
    this.secondaryColor = data.secondaryColor || undefined;
    this.pinnedRoundIds = data.pinnedRoundIds || [];
    this.features = new ClubFeatures(data.features || {});
    this.tagline = data.tagline || undefined;
    this.clubType = data.clubType || undefined;
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
    this.landingPageConfig = data.landingPageConfig || undefined;

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
      pinnedRoundIds: this.pinnedRoundIds,
      features: this.features.toDictionary(),
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt)
    };

    if (this.coverImageURL) {
      dict.coverImageURL = this.coverImageURL;
    }

    if (this.logoURL) {
      dict.logoURL = this.logoURL;
    }

    if (this.accentColor) {
      dict.accentColor = this.accentColor;
    }

    if (this.secondaryColor) {
      dict.secondaryColor = this.secondaryColor;
    }

    if (this.tagline) {
      dict.tagline = this.tagline;
    }

    if (this.clubType) {
      dict.clubType = this.clubType;
    }

    if (this.landingPageConfig) {
      dict.landingPageConfig = this.landingPageConfig;
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
  totalPoints: number;

  constructor(data: any) {
    this.clubId = data.clubId || '';
    this.userId = data.userId || '';
    this.id = data.id || ClubMember.generateMemberId(this.clubId, this.userId);
    this.joinedVia = data.joinedVia || 'unknown';
    this.joinedAt = convertFirestoreTimestamp(data.joinedAt);
    this.isActive = data.isActive !== false; // Default to true
    this.totalPoints = data.totalPoints || 0;

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
      isActive: this.isActive,
      totalPoints: this.totalPoints,
    };
  }

  /**
   * Generates a consistent member ID from clubId and userId
   */
  static generateMemberId(clubId: string, userId: string): string {
    return `${clubId}_${userId}`;
  }
}

export class ClubEvent {
  id: string;
  clubId: string;
  creatorId: string;
  title: string;
  description: string;
  locationName: string;
  address: string;
  timezoneIdentifier: string;
  startDate: Date;
  endDate: Date;
  source: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
    this.id = data.id || '';
    this.clubId = data.clubId || '';
    this.creatorId = data.creatorId || '';
    this.title = data.title || '';
    this.description = data.description || '';
    this.locationName = data.locationName || '';
    this.address = data.address || '';
    this.timezoneIdentifier = data.timezoneIdentifier || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    this.startDate = convertFirestoreTimestamp(data.startDate);
    this.endDate = convertFirestoreTimestamp(data.endDate);
    this.source = data.source || 'event-checkin';
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
  }

  get isUpcoming(): boolean {
    return this.endDate >= new Date();
  }

  get displayLocation(): string {
    const trimmedLocationName = this.locationName.trim();
    const trimmedAddress = this.address.trim();

    if (trimmedLocationName && trimmedAddress) {
      return `${trimmedLocationName} • ${trimmedAddress}`;
    }

    if (trimmedLocationName) {
      return trimmedLocationName;
    }

    if (trimmedAddress) {
      return trimmedAddress;
    }

    return 'Location TBD';
  }

  toDictionary(): { [key: string]: any } {
    return {
      id: this.id,
      clubId: this.clubId,
      creatorId: this.creatorId,
      title: this.title,
      description: this.description,
      locationName: this.locationName,
      address: this.address,
      timezoneIdentifier: this.timezoneIdentifier,
      startDate: dateToUnixTimestamp(this.startDate),
      endDate: dateToUnixTimestamp(this.endDate),
      source: this.source,
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt),
    };
  }
}
