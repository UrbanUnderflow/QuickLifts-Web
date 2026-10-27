// Clay is the only PulseCheck visual style. These values mirror the iOS Clay
// palette (PulseCheckClayPalette) and the athlete baseline. Tailwind exposes
// them as `clay-*` colors and `--clay-*` CSS variables; inline styles import
// them directly. Fit With Pulse surfaces do not use these tokens.
const CLAY = Object.freeze({
  paper: '#171B1C',
  surface: '#242829',
  raised: '#2E3334',
  raisedSelected: '#343A3B',
  ink: '#F2F2E8',
  ink2: 'rgba(242,242,232,0.72)',
  ink3: 'rgba(242,242,232,0.52)',
  line: 'rgba(242,242,232,0.14)',
  lineStrong: 'rgba(242,242,232,0.3)',
  // Primary action fill; text on lime always uses onLime.
  lime: '#D4EA04',
  limeDeep: '#A9BB03',
  onLime: '#232817',
  // Quiet secondary accent for charts and tags that sit beside lime.
  sage: '#A7D7C2',
  // Light Clay variant (coach dashboard and light admin surfaces).
  lightPaper: '#F7F8F5',
  lightInk: '#22302E',
  lightMuted: '#65716C',
  moss: '#246863',
});

// rgb triplets so Tailwind opacity modifiers (bg-clay-lime/10) work.
const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(' ');

const CLAY_FONTS = Object.freeze({
  sans: "'Clay Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  serif: "'Clay Serif', Georgia, 'Times New Roman', serif",
});

function clayCssVariables() {
  const kebab = key => key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
  const vars = {};
  for (const [key, value] of Object.entries(CLAY)) {
    vars[`--clay-${kebab(key)}`] = value;
    if (value.startsWith('#')) vars[`--clay-${kebab(key)}-rgb`] = hexToRgb(value);
  }
  vars['--clay-sans'] = CLAY_FONTS.sans;
  vars['--clay-serif'] = CLAY_FONTS.serif;
  return vars;
}

function clayTailwindColors() {
  const kebab = key => key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
  const colors = {};
  for (const [key, value] of Object.entries(CLAY)) {
    colors[kebab(key)] = value.startsWith('#') ? `rgb(var(--clay-${kebab(key)}-rgb) / <alpha-value>)` : `var(--clay-${kebab(key)})`;
  }
  return colors;
}

/** rgba() for a hex Clay token, for inline styles that need transparency. */
function clayAlpha(hex, alpha) {
  return `rgba(${hexToRgb(hex).split(' ').join(',')},${alpha})`;
}

module.exports = { CLAY, CLAY_FONTS, clayCssVariables, clayTailwindColors, clayAlpha };
