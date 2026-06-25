import { doc, getDoc } from 'firebase/firestore';
import type { ParsedUrlQuery } from 'querystring';
import { db } from '../api/firebase/config';
import type { PartnerSource, PartnerSourceType } from '../api/firebase/user';

export const PARTNER_SOURCE_TYPES: PartnerSourceType[] = ['brand', 'gym', 'runClub'];

export const normalizeQueryValue = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : '';
  }

  return typeof value === 'string' ? value.trim() : '';
};

export const parsePartnerSourceType = (value: string): PartnerSourceType | null => {
  return PARTNER_SOURCE_TYPES.includes(value as PartnerSourceType) ? (value as PartnerSourceType) : null;
};

export const extractPartnerInviteCodeFromQuery = (query: ParsedUrlQuery | Record<string, string | string[] | undefined>): string => {
  return (
    normalizeQueryValue(query.inviteCode) ||
    normalizeQueryValue(query.gymInviteCode) ||
    normalizeQueryValue(query.partnerInviteCode) ||
    normalizeQueryValue(query.code)
  );
};

export const buildPartnerSourceFromQuery = (
  query: ParsedUrlQuery | Record<string, string | string[] | undefined>
): PartnerSource | undefined => {
  const directType = parsePartnerSourceType(normalizeQueryValue(query.partnerType));
  const directPartnerId = normalizeQueryValue(query.partnerId);

  if (directType && directPartnerId) {
    return {
      type: directType,
      partnerId: doc(db, 'partners', directPartnerId),
    };
  }

  const utmDerivedType = parsePartnerSourceType(
    normalizeQueryValue(query.utm_partner_type) || normalizeQueryValue(query.utm_partnerType)
  );
  const utmDerivedPartnerId =
    normalizeQueryValue(query.utm_partner_id) ||
    normalizeQueryValue(query.utm_partnerId) ||
    normalizeQueryValue(query.utm_partner);

  if (utmDerivedType && utmDerivedPartnerId) {
    return {
      type: utmDerivedType,
      partnerId: doc(db, 'partners', utmDerivedPartnerId),
    };
  }

  return undefined;
};
