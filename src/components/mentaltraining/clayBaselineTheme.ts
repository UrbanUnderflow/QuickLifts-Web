// Clay tokens for the athlete baseline. Values mirror the iOS Clay palette
// (PulseCheckClayPalette, ClayFormFonts) so the embedded web page matches the
// native header around it. Plain CSS: the baseline also ships in a standalone
// esbuild bundle that never loads Tailwind or globals.css, so the values are
// interpolated from the shared tokens rather than read from --clay-* variables.
import { CLAY, CLAY_FONTS } from '../../styles/clay/tokens';

export const CLAY_BASELINE_THEME = `
@font-face { font-family: 'Clay Inter'; src: url('/fonts/clay/Inter-opsz-wght.ttf') format('truetype'); font-weight: 100 900; font-display: swap; }
@font-face { font-family: 'Clay Serif'; src: url('/fonts/clay/SourceSerif4-opsz-wght.ttf') format('truetype'); font-weight: 200 900; font-display: swap; }
.clay-baseline {
  --paper: ${CLAY.paper}; --surface: ${CLAY.surface}; --raised: ${CLAY.raised}; --raised-selected: ${CLAY.raisedSelected};
  --ink: ${CLAY.ink}; --ink-2: ${CLAY.ink2}; --ink-3: ${CLAY.ink3};
  --line: ${CLAY.line}; --line-strong: ${CLAY.lineStrong}; --control: rgba(242,242,232,0.5);
  --lime: ${CLAY.lime}; --on-lime: ${CLAY.onLime};
  --sans: ${CLAY_FONTS.sans};
  --serif: ${CLAY_FONTS.serif};
  font-family: var(--sans); color: var(--ink); background: var(--paper);
  -webkit-font-smoothing: antialiased;
}
`;
