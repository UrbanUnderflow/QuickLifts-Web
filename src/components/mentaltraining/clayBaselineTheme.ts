// Clay tokens for the athlete baseline. Values mirror the iOS Clay palette
// (PulseCheckClayPalette, ClayFormFonts) so the embedded web page matches the
// native header around it. Plain CSS: the baseline also ships in a standalone
// esbuild bundle that never loads Tailwind or globals.css.
export const CLAY_BASELINE_THEME = `
@font-face { font-family: 'Clay Inter'; src: url('/fonts/clay/Inter-opsz-wght.ttf') format('truetype'); font-weight: 100 900; font-display: swap; }
@font-face { font-family: 'Clay Serif'; src: url('/fonts/clay/SourceSerif4-opsz-wght.ttf') format('truetype'); font-weight: 200 900; font-display: swap; }
.clay-baseline {
  --paper: #171B1C; --surface: #242829; --raised: #2E3334; --raised-selected: #343A3B;
  --ink: #F2F2E8; --ink-2: rgba(242,242,232,0.72); --ink-3: rgba(242,242,232,0.52);
  --line: rgba(242,242,232,0.14); --line-strong: rgba(242,242,232,0.3); --control: rgba(242,242,232,0.5);
  --lime: #D4EA04; --on-lime: #232817;
  --sans: 'Clay Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --serif: 'Clay Serif', Georgia, 'Times New Roman', serif;
  font-family: var(--sans); color: var(--ink); background: var(--paper);
  -webkit-font-smoothing: antialiased;
}
`;
