export interface Coach {
  id: string;
  userId: string;
  referralCode: string;
  referredByCoachId?: string;
  stripeCustomerId?: string;
  subscriptionStatus: 'active' | 'past_due' | 'canceled';
  schedulingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoachAthlete {
  id: string;
  coachId: string;
  athleteUserId: string;
  linkedAt: Date;
}

export interface CoachReferral {
  id: string;
  referrerCoachId: string;
  referredCoachId: string;
  createdAt: Date;
}

// Extended User type - add these fields to existing User interface
export interface UserCoachExtension {
  role: 'athlete' | 'coach';
  linkedCoachId?: string;
}

// Firestore document data types (before date conversion)
export interface CoachFirestoreData {
  userId: string;
  referralCode: string;
  referredByCoachId?: string; // Legacy field, may still exist in old data
  linkedPartnerId?: string; // For standard coaches: which partner they're linked to for revenue sharing
  stripeCustomerId?: string;
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'partner';
  promoCodeUsed?: string; // For partners: track which promo code was used (if any)
  userType?: 'coach' | 'partner'; // Distinguish between paying coaches and partners
  createdAt: number | string | Date;
  updatedAt: number | string | Date;
}

export interface CoachAthleteFirestoreData {
  coachId: string;
  athleteUserId: string;
  linkedAt: number | string | Date;
}

export interface CoachReferralFirestoreData {
  referrerCoachId: string;
  referredCoachId: string;
  createdAt: number | string | Date;
}

// Coach model classes with proper date handling
import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../utils/formatDate';

export class CoachModel {
  id: string;
  userId: string;
  referralCode: string;
  referredByCoachId?: string;
  linkedPartnerId?: string;
  stripeCustomerId?: string;
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'partner';
  promoCodeUsed?: string;
  userType?: 'coach' | 'partner';
  createdAt: Date;
  updatedAt: Date;

  constructor(id: string, data: CoachFirestoreData) {
    this.id = id;
    this.userId = data.userId;
    this.referralCode = data.referralCode;
    this.referredByCoachId = data.referredByCoachId;
    this.linkedPartnerId = data.linkedPartnerId;
    this.stripeCustomerId = data.stripeCustomerId;
    this.subscriptionStatus = data.subscriptionStatus;
    this.promoCodeUsed = data.promoCodeUsed;
    this.userType = data.userType;
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
  }

  toDictionary(): Record<string, any> {
    const dict: Record<string, any> = {
      userId: this.userId,
      referralCode: this.referralCode,
      subscriptionStatus: this.subscriptionStatus,
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt),
    };

    if (this.referredByCoachId) {
      dict.referredByCoachId = this.referredByCoachId;
    }
    if (this.linkedPartnerId) {
      dict.linkedPartnerId = this.linkedPartnerId;
    }
    if (this.stripeCustomerId) {
      dict.stripeCustomerId = this.stripeCustomerId;
    }
    if (this.promoCodeUsed) {
      dict.promoCodeUsed = this.promoCodeUsed;
    }
    if (this.userType) {
      dict.userType = this.userType;
    }

    return dict;
  }
}

export class CoachAthleteModel {
  id: string;
  coachId: string;
  athleteUserId: string;
  linkedAt: Date;

  constructor(id: string, data: CoachAthleteFirestoreData) {
    this.id = id;
    this.coachId = data.coachId;
    this.athleteUserId = data.athleteUserId;
    this.linkedAt = convertFirestoreTimestamp(data.linkedAt);
  }

  toDictionary(): Record<string, any> {
    return {
      coachId: this.coachId,
      athleteUserId: this.athleteUserId,
      linkedAt: dateToUnixTimestamp(this.linkedAt),
    };
  }
}

export class CoachReferralModel {
  id: string;
  referrerCoachId: string;
  referredCoachId: string;
  createdAt: Date;

  constructor(id: string, data: CoachReferralFirestoreData) {
    this.id = id;
    this.referrerCoachId = data.referrerCoachId;
    this.referredCoachId = data.referredCoachId;
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
  }

  toDictionary(): Record<string, any> {
    return {
      referrerCoachId: this.referrerCoachId,
      referredCoachId: this.referredCoachId,
      createdAt: dateToUnixTimestamp(this.createdAt),
    };
  }
}
