// Shared client-side phone helpers for PulseCheck onboarding flows.
// Single source of truth used by post-activation (coach) and athlete onboarding
// so phone normalization/validation stays consistent across surfaces.

/** Defaults bare 10-digit input to US (+1). Returns '' if it can't be normalized. */
export const normalizePhoneToE164 = (raw: string): string => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (hasPlus) {
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : '';
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return '';
};

export const isValidE164 = (value: string): boolean => /^\+\d{10,15}$/.test(value);
