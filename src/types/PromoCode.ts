// Promo code types for partnership invitations

// Firestore document data types (before date conversion)
export interface PromoCodeFirestoreData {
  code: string;
  type: 'partner' | 'discount' | 'trial';
  isActive: boolean;
  usageLimit?: number; // null = unlimited
  usageCount: number;
  description?: string;
  createdBy: string; // admin userId who created this code
  createdAt: number | string | Date;
  expiresAt?: number | string | Date;
  metadata?: Record<string, any>; // flexible for additional data
}

export interface PromoCodeUsageFirestoreData {
  promoCodeId: string;
  userId: string;
  usedAt: number | string | Date;
  metadata?: Record<string, any>;
}

// Model classes with proper date handling
import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../utils/formatDate';

export class PromoCodeModel {
  id: string;
  code: string;
  type: 'partner' | 'discount' | 'trial';
  isActive: boolean;
  usageLimit?: number;
  usageCount: number;
  description?: string;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;

  constructor(id: string, data: PromoCodeFirestoreData) {
    this.id = id;
    this.code = data.code;
    this.type = data.type;
    this.isActive = data.isActive;
    this.usageLimit = data.usageLimit;
    this.usageCount = data.usageCount;
    this.description = data.description;
    this.createdBy = data.createdBy;
    this.createdAt = convertFirestoreTimestamp(data.createdAt);
    this.expiresAt = data.expiresAt ? convertFirestoreTimestamp(data.expiresAt) : undefined;
    this.metadata = data.metadata;
  }

  // Check if promo code is valid for use
  isValid(): boolean {
    if (!this.isActive) return false;
    if (this.expiresAt && this.expiresAt < new Date()) return false;
    if (this.usageLimit && this.usageCount >= this.usageLimit) return false;
    return true;
  }

  // Check if promo code can still be used (has remaining uses)
  hasUsesRemaining(): boolean {
    if (!this.usageLimit) return true; // unlimited
    return this.usageCount < this.usageLimit;
  }

  toDictionary(): Record<string, any> {
    const dict: Record<string, any> = {
      code: this.code,
      type: this.type,
      isActive: this.isActive,
      usageCount: this.usageCount,
      createdBy: this.createdBy,
      createdAt: dateToUnixTimestamp(this.createdAt),
    };

    if (this.usageLimit !== undefined) {
      dict.usageLimit = this.usageLimit;
    }
    if (this.description) {
      dict.description = this.description;
    }
    if (this.expiresAt) {
      dict.expiresAt = dateToUnixTimestamp(this.expiresAt);
    }
    if (this.metadata) {
      dict.metadata = this.metadata;
    }

    return dict;
  }
}

export class PromoCodeUsageModel {
  id: string;
  promoCodeId: string;
  userId: string;
  usedAt: Date;
  metadata?: Record<string, any>;

  constructor(id: string, data: PromoCodeUsageFirestoreData) {
    this.id = id;
    this.promoCodeId = data.promoCodeId;
    this.userId = data.userId;
    this.usedAt = convertFirestoreTimestamp(data.usedAt);
    this.metadata = data.metadata;
  }

  toDictionary(): Record<string, any> {
    const dict: Record<string, any> = {
      promoCodeId: this.promoCodeId,
      userId: this.userId,
      usedAt: dateToUnixTimestamp(this.usedAt),
    };

    if (this.metadata) {
      dict.metadata = this.metadata;
    }

    return dict;
  }
}
