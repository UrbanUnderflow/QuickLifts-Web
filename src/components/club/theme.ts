export const CLUB_TYPE_LABELS: Record<string, string> = {
  runClub: 'Run Club',
  trackClub: 'Track Club',
  trainingClub: 'Training Club',
  liftClub: 'Lift Club',
  stretchClub: 'Stretch Club',
  hiitClub: 'HIIT Club',
  yogaClub: 'Yoga Club',
  crossFitClub: 'CrossFit Club',
  boxingClub: 'Boxing Club',
  cyclingClub: 'Cycling Club',
  swimmingClub: 'Swimming Club',
  calisthenicsClub: 'Calisthenics Club',
  generalFitness: 'General Fitness',
};

export const CLUB_TYPE_ICON_NAMES: Record<string, string> = {
  runClub: 'figure.run',
  trackClub: 'person.simple.run',
  trainingClub: 'figure.strengthtraining.traditional',
  liftClub: 'dumbbell',
  stretchClub: 'activity',
  hiitClub: 'zap',
  yogaClub: 'sparkles',
  crossFitClub: 'flame',
  boxingClub: 'shield',
  cyclingClub: 'bike',
  swimmingClub: 'waves',
  calisthenicsClub: 'award',
  generalFitness: 'heart',
};

export const ensureHexColor = (rawColor?: string | null, fallback = '#E0FE10'): string => {
  if (!rawColor) {
    return fallback;
  }

  return rawColor.startsWith('#') ? rawColor : `#${rawColor}`;
};

export const deriveDarkBackground = (hex: string): string => {
  const sanitizedHex = hex.replace('#', '');
  const r = parseInt(sanitizedHex.slice(0, 2), 16) / 255;
  const g = parseInt(sanitizedHex.slice(2, 4), 16) / 255;
  const b = parseInt(sanitizedHex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const d = max - min;

  if (d > 0) {
    s = d / max;
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / d + 2) / 6;
    } else {
      h = ((r - g) / d + 4) / 6;
    }
  }

  const ns = s * 0.6;
  const nv = 0.06;
  const c = nv * ns;
  const x = c * (1 - Math.abs((h * 6) % 2 - 1));
  const m = nv - c;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  const hi = Math.floor(h * 6) % 6;

  if (hi === 0) {
    r1 = c;
    g1 = x;
  } else if (hi === 1) {
    r1 = x;
    g1 = c;
  } else if (hi === 2) {
    g1 = c;
    b1 = x;
  } else if (hi === 3) {
    g1 = x;
    b1 = c;
  } else if (hi === 4) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const toHex = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
};

export const getAccentTextColor = (hex: string): string => {
  const sanitizedHex = hex.replace('#', '');
  const r = parseInt(sanitizedHex.slice(0, 2), 16);
  const g = parseInt(sanitizedHex.slice(2, 4), 16);
  const b = parseInt(sanitizedHex.slice(4, 6), 16);
  const isLightAccent = (r * 299 + g * 587 + b * 114) / 1000 > 128;
  return isLightAccent ? '#000000' : '#ffffff';
};

export const formatCompactNumber = (value: number): string => {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return millions % 1 === 0 ? `${millions.toFixed(0)}M` : `${millions.toFixed(1)}M`;
  }

  if (value >= 1_000) {
    const thousands = value / 1_000;
    return thousands % 1 === 0 ? `${thousands.toFixed(0)}K` : `${thousands.toFixed(1)}K`;
  }

  return `${value}`;
};
