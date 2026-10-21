/** Installed app identity comes from persisted productBrand, never appBranding. */
export type NativeProductBrand = 'pulsecheck' | 'athleticmind';

export const normalizeNativeProductBrand = (value: unknown): NativeProductBrand =>
  value === 'athleticmind' ? 'athleticmind' : 'pulsecheck';

const storeUrl = (value: string | undefined, host: string): string | null => {
  try {
    const url = new URL(value || '');
    if (url.protocol !== 'https:' || url.hostname !== host) return null;
    if (host === 'apps.apple.com' && (!/\/id\d+$/.test(url.pathname) || /\/id(6747253393|6451497729)$/.test(url.pathname))) return null;
    if (host === 'play.google.com' && (url.pathname !== '/store/apps/details' || !url.searchParams.get('id') || ['com.fitwithpulse.pulsecheck', 'ai.fitwithpulse.pulse'].includes(url.searchParams.get('id')!))) return null;
    return url.toString();
  } catch {
    return null;
  }
};

export const getNativeAppDistribution = (productBrand: unknown) => {
  const brand = normalizeNativeProductBrand(productBrand);
  if (brand === 'athleticmind') {
    return {
      brand,
      name: 'AthleticMind',
      scheme: 'athleticmind',
      iosUrl: storeUrl(process.env.NEXT_PUBLIC_ATHLETICMIND_IOS_APP_STORE_URL, 'apps.apple.com'),
      androidUrl: storeUrl(process.env.NEXT_PUBLIC_ATHLETICMIND_ANDROID_PLAY_STORE_URL, 'play.google.com'),
      oneLinkUrl: athleticMindOneLinkUrl(),
    };
  }
  return {
    brand,
    name: 'PulseCheck',
    scheme: 'pulsecheck',
    iosUrl: 'https://apps.apple.com/app/pulsecheck-mindset-coaching/id6747253393',
    androidUrl: 'https://play.google.com/store/apps/details?id=com.fitwithpulse.pulsecheck',
    oneLinkUrl: 'https://pulsecheckapp.onelink.me/uT14',
  };
};

const athleticMindOneLinkUrl = (): string | null => {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_ATHLETICMIND_ONELINK_URL || '');
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.onelink.me') ||
        url.hostname === 'pulsecheckapp.onelink.me' || !/^\/[A-Za-z0-9]+$/.test(url.pathname)) return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
};
