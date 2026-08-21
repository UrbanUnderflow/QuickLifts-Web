/* eslint-disable */
// Render the PulseCheck Pro social preview image.
//
// Usage: node scripts/generate-pulsecheck-pro-og.js

const path = require('path');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

const WIDTH = 1200;
const HEIGHT = 630;
const OUT_CLEAN = path.join(__dirname, '..', 'public', 'pulsecheck-pro-og-clean.png');
const OUT_LEGACY = path.join(__dirname, '..', 'public', 'pulsecheck-pro-og.png');
const ICON_PATH = path.join(__dirname, '..', 'public', 'pulsecheck-logo.svg');

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Rounded', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const svg = `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${WIDTH}" y2="${HEIGHT}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#05070C"/>
      <stop offset="0.54" stop-color="#070A12"/>
      <stop offset="1" stop-color="#11091E"/>
    </linearGradient>
    <radialGradient id="auraOne" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1010 104) rotate(135) scale(430 310)">
      <stop stop-color="#46E7F2" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#46E7F2" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="auraTwo" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(160 570) rotate(-34) scale(440 280)">
      <stop stop-color="#E0FE10" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#E0FE10" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="panel" x1="652" y1="94" x2="1120" y2="534" gradientUnits="userSpaceOnUse">
      <stop stop-color="#121927" stop-opacity="0.92"/>
      <stop offset="1" stop-color="#080B13" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#E0FE10"/>
      <stop offset="0.48" stop-color="#46E7F2"/>
      <stop offset="1" stop-color="#A07CFF"/>
    </linearGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#E0FE10"/>
      <stop offset="0.5" stop-color="#46E7F2"/>
      <stop offset="1" stop-color="#FF8AA5"/>
    </linearGradient>
    <filter id="shadow" x="-12%" y="-12%" width="124%" height="124%">
      <feDropShadow dx="0" dy="26" stdDeviation="34" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
    <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="12"/>
    </filter>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#auraOne)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#auraTwo)"/>

  <g opacity="0.08">
    ${Array.from({ length: 26 }, (_, i) => `<path d="M${80 + i * 46} 0V${HEIGHT}" stroke="#FFFFFF"/>`).join('')}
    ${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${74 + i * 44}H${WIDTH}" stroke="#FFFFFF"/>`).join('')}
  </g>

  <path d="M74 500C194 402 321 386 450 451C558 505 670 508 785 458C904 407 1015 418 1126 494" stroke="url(#line)" stroke-width="2" stroke-opacity="0.42"/>
  <path d="M74 500C194 402 321 386 450 451C558 505 670 508 785 458C904 407 1015 418 1126 494" stroke="#46E7F2" stroke-width="9" stroke-opacity="0.08" filter="url(#softGlow)"/>

  <g transform="translate(72 78)">
    <rect x="0" y="0" width="64" height="64" rx="18" fill="#FFFFFF" fill-opacity="0.08" stroke="#FFFFFF" stroke-opacity="0.12"/>
    <text x="84" y="28"
      font-family="${FONT_STACK}"
      font-size="26"
      font-weight="800"
      fill="#FFFFFF">PulseCheck</text>
    <text x="84" y="54"
      font-family="${FONT_STACK}"
      font-size="20"
      font-weight="700"
      fill="#AAB6C8">Pro</text>
  </g>

  <g transform="translate(72 198)">
    <text x="0" y="0"
      font-family="${FONT_STACK}"
      font-size="72"
      font-weight="850"
      fill="#F7FAFF">Train the mind</text>
    <text x="0" y="82"
      font-family="${FONT_STACK}"
      font-size="72"
      font-weight="850"
      fill="#F7FAFF">like the body.</text>
    <rect x="0" y="116" width="518" height="5" rx="3" fill="url(#line)"/>
    <text x="0" y="170"
      font-family="${FONT_STACK}"
      font-size="30"
      font-weight="750"
      fill="#46E7F2">One mental skill. Every day.</text>
    <text x="0" y="220"
      font-family="${FONT_STACK}"
      font-size="25"
      font-weight="600"
      fill="#AAB6C8">pulsecheckmind.ai</text>
  </g>

  <g transform="translate(668 74)" filter="url(#shadow)">
    <rect x="0" y="0" width="458" height="482" rx="30" fill="url(#panel)" stroke="#FFFFFF" stroke-opacity="0.14"/>
    <rect x="26" y="24" width="406" height="66" rx="20" fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-opacity="0.08"/>
    <circle cx="62" cy="57" r="13" fill="#E0FE10"/>
    <text x="92" y="53"
      font-family="${FONT_STACK}"
      font-size="18"
      font-weight="800"
      fill="#FFFFFF">Today's prescription</text>
    <text x="92" y="73"
      font-family="${FONT_STACK}"
      font-size="13"
      font-weight="700"
      fill="#AAB6C8">Competition week</text>
    <rect x="340" y="42" width="64" height="28" rx="14" fill="#E0FE10" fill-opacity="0.14" stroke="#E0FE10" stroke-opacity="0.36"/>
    <text x="372" y="61"
      font-family="${FONT_STACK}"
      font-size="13"
      font-weight="800"
      fill="#E0FE10"
      text-anchor="middle">LIVE</text>

    <g transform="translate(32 122)">
      <circle cx="74" cy="74" r="72" fill="#05080F" stroke="#FFFFFF" stroke-opacity="0.1"/>
      <circle cx="74" cy="74" r="56" fill="none" stroke="#1C2533" stroke-width="13"/>
      <path d="M74 18A56 56 0 1 1 29.5 108" stroke="url(#accent)" stroke-width="13" stroke-linecap="round"/>
      <text x="74" y="69"
        font-family="${FONT_STACK}"
        font-size="40"
        font-weight="850"
        fill="#FFFFFF"
        text-anchor="middle">76</text>
      <text x="74" y="96"
        font-family="${FONT_STACK}"
        font-size="13"
        font-weight="800"
        fill="#AAB6C8"
        text-anchor="middle">READY</text>
    </g>

    <g transform="translate(196 132)">
      <text x="0" y="0"
        font-family="${FONT_STACK}"
        font-size="15"
        font-weight="800"
        fill="#46E7F2">TODAY'S SIGNAL</text>
      <text x="0" y="39"
        font-family="${FONT_STACK}"
        font-size="28"
        font-weight="850"
        fill="#FFFFFF">Steady capacity</text>
      <text x="0" y="78"
        font-family="${FONT_STACK}"
        font-size="19"
        font-weight="600"
        fill="#B7C2D2">Focus work when the</text>
      <text x="0" y="106"
        font-family="${FONT_STACK}"
        font-size="19"
        font-weight="600"
        fill="#B7C2D2">moment gets loud.</text>
    </g>

    <g transform="translate(32 308)">
      <rect x="0" y="0" width="394" height="58" rx="18" fill="#FFFFFF" fill-opacity="0.055" stroke="#FFFFFF" stroke-opacity="0.08"/>
      <text x="24" y="24"
        font-family="${FONT_STACK}"
        font-size="13"
        font-weight="800"
        fill="#AAB6C8">ACTIVE BLOCK</text>
      <text x="24" y="46"
        font-family="${FONT_STACK}"
        font-size="20"
        font-weight="850"
        fill="#FFFFFF">Focus Mastery</text>
      <rect x="258" y="20" width="110" height="18" rx="9" fill="#1C2533"/>
      <rect x="258" y="20" width="86" height="18" rx="9" fill="url(#accent)"/>
    </g>

    <g transform="translate(32 390)">
      <rect x="0" y="0" width="120" height="50" rx="16" fill="#46E7F2" fill-opacity="0.13" stroke="#46E7F2" stroke-opacity="0.24"/>
      <rect x="137" y="0" width="120" height="50" rx="16" fill="#E0FE10" fill-opacity="0.12" stroke="#E0FE10" stroke-opacity="0.22"/>
      <rect x="274" y="0" width="120" height="50" rx="16" fill="#FF8AA5" fill-opacity="0.12" stroke="#FF8AA5" stroke-opacity="0.22"/>
      <text x="60" y="32" font-family="${FONT_STACK}" font-size="16" font-weight="800" fill="#DDFBFF" text-anchor="middle">Assess</text>
      <text x="197" y="32" font-family="${FONT_STACK}" font-size="16" font-weight="800" fill="#F4FFD1" text-anchor="middle">Train</text>
      <text x="334" y="32" font-family="${FONT_STACK}" font-size="16" font-weight="800" fill="#FFE3EA" text-anchor="middle">Advance</text>
    </g>
  </g>
</svg>`;

async function generate() {
  const icon = await sharp(ICON_PATH)
    .resize(48, 48, { fit: 'contain' })
    .png()
    .toBuffer();

  const image = await sharp(Buffer.from(svg))
    .composite([{ input: icon, left: 80, top: 86 }])
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();

  const cleanInfo = await sharp(image).toFile(OUT_CLEAN);
  const legacyInfo = await sharp(image).toFile(OUT_LEGACY);

  console.log(`Wrote ${OUT_CLEAN} (${cleanInfo.width}x${cleanInfo.height}, ${cleanInfo.size} bytes)`);
  console.log(`Wrote ${OUT_LEGACY} (${legacyInfo.width}x${legacyInfo.height}, ${legacyInfo.size} bytes)`);
}

generate().catch((err) => {
  console.error('Failed to render PulseCheck Pro OG:', err);
  process.exit(1);
});
