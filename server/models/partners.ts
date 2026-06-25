export type PartnerType = 'brand' | 'gym' | 'runClub';

export interface FirestoreTimestampObject {
  toDate?: () => Date;
  seconds?: number;
  nanoseconds?: number;
  _seconds?: number;
  _nanoseconds?: number;
}

export type FirestoreTimestampLike =
  | Date
  | number
  | string
  | null
  | undefined
  | FirestoreTimestampObject;

export interface Partner {
  id: string;
  type: PartnerType;
  name: string;
  contactEmail: string;
  onboardingStage: string;
  invitedAt: Date;
  firstRoundCreatedAt?: Date | null;
}

export interface PartnerFirestoreData {
  type: PartnerType;
  name: string;
  contactEmail: string;
  onboardingStage: string;
  invitedAt: FirestoreTimestampLike;
  firstRoundCreatedAt?: FirestoreTimestampLike;
}

function isFirestoreTimestampObject(value: FirestoreTimestampLike): value is FirestoreTimestampObject {
  return Boolean(value) && typeof value === 'object' && !(value instanceof Date);
}

export function convertPartnerTimestamp(value: FirestoreTimestampLike): Date {
  if (value instanceof Date) return value;

  if (isFirestoreTimestampObject(value)) {
    if (typeof value.toDate === 'function') {
      return value.toDate();
    }

    const secondsCandidate =
      typeof value.seconds === 'number'
        ? value.seconds
        : typeof value._seconds === 'number'
          ? value._seconds
          : null;

    if (secondsCandidate !== null) {
      const nanosCandidate =
        typeof value.nanoseconds === 'number'
          ? value.nanoseconds
          : typeof value._nanoseconds === 'number'
            ? value._nanoseconds
            : 0;
      return new Date(secondsCandidate * 1000 + Math.floor(nanosCandidate / 1000000));
    }
  }
  if (value == null) return new Date();

  const numericValue = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof numericValue !== 'number' || Number.isNaN(numericValue)) {
    return new Date();
  }

  return numericValue < 10000000000 ? new Date(numericValue * 1000) : new Date(numericValue);
}

export function dateToUnixTimestamp(date: Date): number {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return Math.floor(Date.now() / 1000);
  }
  return Math.floor(date.getTime() / 1000);
}

export class PartnerModel implements Partner {
  id: string;
  type: PartnerType;
  name: string;
  contactEmail: string;
  onboardingStage: string;
  invitedAt: Date;
  firstRoundCreatedAt?: Date | null;

  constructor(id: string, data: PartnerFirestoreData) {
    this.id = id;
    this.type = data.type;
    this.name = data.name;
    this.contactEmail = data.contactEmail;
    this.onboardingStage = data.onboardingStage;
    this.invitedAt = convertPartnerTimestamp(data.invitedAt);
    this.firstRoundCreatedAt = data.firstRoundCreatedAt
      ? convertPartnerTimestamp(data.firstRoundCreatedAt)
      : null;
  }

  toDictionary(): PartnerFirestoreData {
    return {
      type: this.type,
      name: this.name,
      contactEmail: this.contactEmail,
      onboardingStage: this.onboardingStage,
      invitedAt: dateToUnixTimestamp(this.invitedAt),
      firstRoundCreatedAt: this.firstRoundCreatedAt
        ? dateToUnixTimestamp(this.firstRoundCreatedAt)
        : null,
    };
  }
}
