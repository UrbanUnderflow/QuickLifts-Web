/* eslint-disable */
// One-off script: render the Macra social preview to /public/macra-og.png.
// The composition mirrors the /Macra hero: dark scan grid, phone frame,
// food recognition label, and macro readout.
//
// Usage: node scripts/generate-macra-og.js

const path = require('path');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

const ROUNDED_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#060A07"/>
      <stop offset="45%" stop-color="#0B120C"/>
      <stop offset="100%" stop-color="#10170F"/>
    </linearGradient>
    <linearGradient id="macraText" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#BEF264"/>
      <stop offset="58%" stop-color="#2DD4BF"/>
      <stop offset="100%" stop-color="#A78BFA"/>
    </linearGradient>
    <radialGradient id="glow" cx="52%" cy="47%" r="55%">
      <stop offset="0%" stop-color="#BEF264" stop-opacity="0.18"/>
      <stop offset="45%" stop-color="#2DD4BF" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#0B0F0B" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="scanGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#E0FE10" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#E0FE10" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="meat" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#D89334"/>
      <stop offset="65%" stop-color="#96521E"/>
      <stop offset="100%" stop-color="#563012"/>
    </linearGradient>
    <filter id="softShadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#000000" flood-opacity="0.42"/>
    </filter>
    <filter id="greenGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#E0FE10" flood-opacity="0.55"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <g opacity="0.16">
    <path d="M0 70H1200M0 140H1200M0 210H1200M0 280H1200M0 350H1200M0 420H1200M0 490H1200M0 560H1200" stroke="#BEF264"/>
    <path d="M80 0V630M160 0V630M240 0V630M320 0V630M400 0V630M480 0V630M560 0V630M640 0V630M720 0V630M800 0V630M880 0V630M960 0V630M1040 0V630M1120 0V630" stroke="#2F4A1D"/>
  </g>

  <g transform="translate(72 78)">
    <rect x="0" y="0" width="68" height="68" rx="18" fill="#BEF264" filter="url(#greenGlow)"/>
    <rect x="9" y="9" width="50" height="50" rx="15" fill="#17200F"/>
    <circle cx="34" cy="34" r="19" fill="#BEF264"/>
    <path d="M20 34h7l4-12 8 24 5-12h4" fill="none" stroke="#17200F" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="88" y="46" font-family="${ROUNDED_FONT_STACK}" font-size="38" font-weight="800" fill="#FFFFFF">Macra</text>
  </g>

  <g transform="translate(72 226)">
    <text x="0" y="0" font-family="${ROUNDED_FONT_STACK}" font-size="74" font-weight="900" fill="#FFFFFF" letter-spacing="-2">
      Point at food.
    </text>
    <text x="0" y="86" font-family="${ROUNDED_FONT_STACK}" font-size="74" font-weight="900" fill="url(#macraText)" letter-spacing="-2" font-style="italic">
      Get macros,
    </text>
    <text x="0" y="164" font-family="${ROUNDED_FONT_STACK}" font-size="74" font-weight="900" fill="url(#macraText)" letter-spacing="-2" font-style="italic">
      instantly.
    </text>
    <text x="2" y="236" font-family="${ROUNDED_FONT_STACK}" font-size="25" font-weight="600" fill="#FFFFFF" fill-opacity="0.64">
      AI calorie and macro scanner for iOS.
    </text>
  </g>

  <g transform="translate(624 34)" filter="url(#softShadow)">
    <rect x="0" y="0" width="420" height="590" rx="76" fill="#171D15" stroke="#26351A" stroke-width="5"/>
    <rect x="22" y="24" width="376" height="542" rx="56" fill="#050808" stroke="#1E3212" stroke-width="2"/>
    <path d="M150 25h122c0 30-17 46-43 46h-36c-26 0-43-16-43-46Z" fill="#111313"/>

    <g transform="translate(54 82)">
      <path d="M0 16h12l9-28 18 56 12-28h10" fill="none" stroke="#E0FE10" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="76" y="25" font-family="${ROUNDED_FONT_STACK}" font-size="28" font-weight="800" fill="#FFFFFF">Macra</text>
      <rect x="244" y="-8" width="120" height="42" fill="#17240D" stroke="#506524" stroke-width="4"/>
      <circle cx="265" cy="13" r="7" fill="#E0FE10"/>
      <text x="282" y="22" font-family="${ROUNDED_FONT_STACK}" font-size="19" font-weight="900" fill="#E0FE10" letter-spacing="6">SCAN</text>
    </g>

    <g transform="translate(105 194)">
      <rect x="-22" y="-22" width="264" height="264" rx="22" fill="url(#scanGlow)"/>
      <rect x="0" y="0" width="220" height="220" rx="14" fill="#16200E" stroke="#E0FE10" stroke-width="5" stroke-dasharray="9 7"/>
      <g opacity="0.36" stroke="#E0FE10" stroke-width="1.5">
        <path d="M0 44H220M0 88H220M0 132H220M0 176H220M44 0V220M88 0V220M132 0V220M176 0V220"/>
      </g>
      <path d="M105 104 C128 81 164 94 172 129 C181 168 146 191 114 172 C84 154 79 128 105 104Z" fill="url(#meat)"/>
      <ellipse cx="100" cy="98" rx="18" ry="11" fill="#E5E1D7" transform="rotate(32 100 98)"/>
      <ellipse cx="84" cy="85" rx="15" ry="10" fill="#F4F1E8" transform="rotate(38 84 85)"/>
      <rect x="82" y="86" width="44" height="18" rx="9" fill="#D8D4CA" transform="rotate(35 82 86)"/>
      <rect x="132" y="159" width="244" height="58" rx="29" fill="#08100A" stroke="#6C851F" stroke-width="3"/>
      <circle cx="164" cy="188" r="8" fill="#BEF264"/>
      <text x="188" y="198" font-family="${ROUNDED_FONT_STACK}" font-size="27" font-weight="900" fill="#E0FE10">Grilled Chicken</text>
    </g>

    <g transform="translate(65 472)">
      <rect x="0" y="0" width="290" height="76" rx="28" fill="#09100A" stroke="#30440F" stroke-width="3"/>
      <text x="28" y="45" font-family="${ROUNDED_FONT_STACK}" font-size="47" font-weight="900" fill="#E0FE10">284</text>
      <text x="34" y="63" font-family="${ROUNDED_FONT_STACK}" font-size="16" font-weight="500" fill="#FFFFFF" fill-opacity="0.45" letter-spacing="3">kcal</text>
      <path d="M116 17V59" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="2"/>
      <text x="163" y="31" font-family="${ROUNDED_FONT_STACK}" font-size="16" font-weight="900" fill="#BEF264">P</text>
      <text x="149" y="55" font-family="${ROUNDED_FONT_STACK}" font-size="31" font-weight="900" fill="#FFFFFF">53</text>
      <text x="188" y="55" font-family="${ROUNDED_FONT_STACK}" font-size="17" font-weight="700" fill="#FFFFFF" fill-opacity="0.62">g</text>
      <rect x="145" y="64" width="56" height="6" rx="3" fill="#BEF264"/>
      <text x="232" y="31" font-family="${ROUNDED_FONT_STACK}" font-size="16" font-weight="900" fill="#2DD4BF">C</text>
      <text x="226" y="55" font-family="${ROUNDED_FONT_STACK}" font-size="31" font-weight="900" fill="#FFFFFF">0</text>
      <text x="250" y="55" font-family="${ROUNDED_FONT_STACK}" font-size="17" font-weight="700" fill="#FFFFFF" fill-opacity="0.62">g</text>
    </g>
  </g>
</svg>`;

const outPath = path.join(__dirname, '..', 'public', 'macra-og.png');

sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(outPath)
  .then((info) => {
    console.log(`✓ Wrote ${outPath} (${info.width}×${info.height}, ${info.size} bytes)`);
  })
  .catch((err) => {
    console.error('✗ Failed to render Macra OG:', err);
    process.exit(1);
  });
