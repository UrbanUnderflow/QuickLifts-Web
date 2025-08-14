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
  referredByCoachId?: string;
  stripeCustomerId?: string;
  subscriptionStatus: 'active' | 'past_due' | 'canceled';
  schedulingUrl?: string;
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
  stripeCustomerId?: string;
  subscriptionStatus: 'active' | 'past_due' | 'canceled';
  schedulingUrl?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(id: string, data: CoachFirestoreData) {
    this.id = id;
    this.userId = data.userId;
    this.referralCode = data.referralCode;
    this.referredByCoachId = data.referredByCoachId;
    this.stripeCustomerId = data.stripeCustomerId;
    this.subscriptionStatus = data.subscriptionStatus;
    this.schedulingUrl = data.schedulingUrl;
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt);
  }

  toDictionary(): Record<string, any> {
    return {
      userId: this.userId,
      referralCode: this.referralCode,
      referredByCoachId: this.referredByCoachId,
      stripeCustomerId: this.stripeCustomerId,
      subscriptionStatus: this.subscriptionStatus,
      schedulingUrl: this.schedulingUrl,
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt),
    };
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
