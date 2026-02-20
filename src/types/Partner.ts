import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../utils/formatDate';

export type PartnerType = 'brand' | 'gym' | 'runClub';

export interface Partner {
  id: string;
  type: PartnerType;
  contactEmail: string;
  onboardingStage: string;
  invitedAt: Date;
  firstRoundCreatedAt?: Date | null;
}

// Firestore representation for the `partners` collection
export interface PartnerFirestoreData {
  type: PartnerType;
  contactEmail: string;
  onboardingStage: string;
  invitedAt: number | string | Date | firebase.firestore.Timestamp | null;
  firstRoundCreatedAt?: number | string | Date | firebase.firestore.Timestamp | null;
}

export class PartnerModel implements Partner {
  id: string;
  type: PartnerType;
  contactEmail: string;
  onboardingStage: string;
  invitedAt: Date;
  firstRoundCreatedAt?: Date | null;

  constructor(id: string, data: PartnerFirestoreData) {
    this.id = id;
    this.type = data.type;
    this.contactEmail = data.contactEmail;
    this.onboardingStage = data.onboardingStage;
    this.invitedAt = convertFirestoreTimestamp(data.invitedAt);
    this.firstRoundCreatedAt = data.firstRoundCreatedAt
      ? convertFirestoreTimestamp(data.firstRoundCreatedAt)
      : null;
  }

  toDictionary(): Record<string, any> {
    const dict: Record<string, any> = {
      type: this.type,
      contactEmail: this.contactEmail,
      onboardingStage: this.onboardingStage,
      invitedAt: dateToUnixTimestamp(this.invitedAt),
    };

    if (this.firstRoundCreatedAt) {
      dict.firstRoundCreatedAt = dateToUnixTimestamp(this.firstRoundCreatedAt);
    }

    return dict;
  }
}
