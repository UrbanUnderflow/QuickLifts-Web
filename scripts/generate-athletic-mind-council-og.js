/* eslint-disable */
// One-off script: render the Athletic Mind Council social preview image.
//
// Usage: node scripts/generate-athletic-mind-council-og.js

const path = require('path');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

const WIDTH = 1200;
const HEIGHT = 630;
const OUT = path.join(__dirname, '..', 'public', 'athletic-mind-council-og-v3.png');

const pulseIconPath = path.join(__dirname, '..', 'public', 'pulsecheck-logo.svg');
const auntEdnaIconPath = path.join(__dirname, '..', 'public', 'auntedna-mark.png');

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const svg = `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${WIDTH}" y2="${HEIGHT}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#061008"/>
      <stop offset="0.48" stop-color="#05060B"/>
      <stop offset="1" stop-color="#150624"/>
    </linearGradient>
    <linearGradient id="card" x1="48" y1="76" x2="1152" y2="554" gradientUnits="userSpaceOnUse">
      <stop stop-color="#070A13" stop-opacity="0.98"/>
      <stop offset="1" stop-color="#080510" stop-opacity="0.98"/>
    </linearGradient>
    <radialGradient id="limeGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(110 92) rotate(42) scale(430 320)">
      <stop stop-color="#E0FE10" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#E0FE10" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="purpleGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(920 510) rotate(-35) scale(410 300)">
      <stop stop-color="#7C3AED" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#7C3AED" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="auntStroke" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#7C3AED"/>
      <stop offset="1" stop-color="#F97316"/>
    </linearGradient>
    <filter id="softShadow" x="-10%" y="-20%" width="120%" height="160%">
      <feDropShadow dx="0" dy="18" stdDeviation="30" flood-color="#000000" flood-opacity="0.46"/>
    </filter>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#limeGlow)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#purpleGlow)"/>

  <g opacity="0.16">
    ${Array.from({ length: 31 }, (_, i) => `<path d="M${i * 40} 0V${HEIGHT}" stroke="#FFFFFF"/>`).join('')}
    ${Array.from({ length: 17 }, (_, i) => `<path d="M0 ${i * 40}H${WIDTH}" stroke="#FFFFFF"/>`).join('')}
  </g>

  <rect x="36" y="64" width="1128" height="500" rx="22" fill="url(#card)" stroke="#FFFFFF" stroke-opacity="0.16" filter="url(#softShadow)"/>
  <rect x="37" y="65" width="1126" height="498" rx="21" stroke="#E0FE10" stroke-opacity="0.12"/>

  <g transform="translate(72 102)">
    <circle cx="6" cy="6" r="5" fill="#E0FE10"/>
    <text x="24" y="12"
      font-family="${FONT_STACK}"
      font-size="18"
      font-weight="800"
      fill="#FFFFFF"
      fill-opacity="0.9"
      letter-spacing="5">PULSECHECK x AUNTEDNA.AI</text>
  </g>

  <text x="600" y="244"
    font-family="${FONT_STACK}"
    font-size="76"
    font-weight="800"
    fill="#F8FAF2"
    text-anchor="middle"
    letter-spacing="0">The Athletic</text>
  <text x="600" y="326"
    font-family="${FONT_STACK}"
    font-size="76"
    font-weight="800"
    fill="#F8FAF2"
    text-anchor="middle"
    letter-spacing="0">Mind Council</text>

  <g transform="translate(235 390)">
    <rect x="0" y="0" width="330" height="104" rx="20" fill="#0A0D12" stroke="#E0FE10" stroke-opacity="0.26"/>
    <rect x="28" y="22" width="60" height="60" rx="13" fill="#0F1117"/>
    <text x="116" y="66"
      font-family="${FONT_STACK}"
      font-size="38"
      font-weight="800"
      fill="#FFFFFF"
      letter-spacing="0">PulseCheck</text>
  </g>

  <g transform="translate(610 390)">
    <rect x="0" y="0" width="400" height="104" rx="20" fill="#0A0A13" stroke="url(#auntStroke)" stroke-opacity="0.5"/>
    <rect x="28" y="22" width="60" height="60" rx="13" fill="#F9F5FF"/>
    <text x="116" y="66"
      font-family="${FONT_STACK}"
      font-size="38"
      font-weight="800"
      fill="#FFFFFF"
      letter-spacing="0">AuntEdna.ai</text>
  </g>
</svg>`;

async function generate() {
  const pulseIcon = await sharp(pulseIconPath)
    .resize(60, 60, { fit: 'contain' })
    .png()
    .toBuffer();

  const auntEdnaIcon = await sharp(auntEdnaIconPath)
    .resize(56, 56, { fit: 'contain', background: { r: 249, g: 245, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  const info = await sharp(Buffer.from(svg))
    .composite([
      { input: pulseIcon, left: 235 + 28, top: 390 + 22 },
      { input: auntEdnaIcon, left: 610 + 30, top: 390 + 26 },
    ])
    .png({ compressionLevel: 9, quality: 92 })
    .toFile(OUT);

  console.log(`Wrote ${OUT} (${info.width}x${info.height}, ${info.size} bytes)`);
}

generate().catch((err) => {
  console.error('Failed to render Athletic Mind Council OG:', err);
  process.exit(1);
});
