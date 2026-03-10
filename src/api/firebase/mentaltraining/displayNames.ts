export const INTERNAL_RESET_FAMILY_NAME = 'The Kill Switch';
export const DISPLAY_RESET_FAMILY_NAME = 'Reset';

export function getDisplayFamilyName(family: string): string {
  if (family === INTERNAL_RESET_FAMILY_NAME || family === 'Kill Switch') {
    return DISPLAY_RESET_FAMILY_NAME;
  }
  return family;
}

export function getDisplayVariantName(name: string): string {
  return name
    .replace(/\bThe Kill Switch\b/g, DISPLAY_RESET_FAMILY_NAME)
    .replace(/\bKill Switch\b/g, DISPLAY_RESET_FAMILY_NAME);
}

export function getDisplaySimText(text: string): string {
  return text
    .replace(/\bThe Kill Switch\b/g, DISPLAY_RESET_FAMILY_NAME)
    .replace(/\bKill Switch\b/g, DISPLAY_RESET_FAMILY_NAME)
    .replace(/\bkill switch\b/g, 'reset');
}
