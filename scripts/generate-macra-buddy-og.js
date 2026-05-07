/* eslint-disable */
// One-off script: render the Macra buddy invite social preview to
// /public/preview/macra-buddy.png.
//
// Usage: node scripts/generate-macra-buddy-og.js

const fs = require('fs');
const path = require('path');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

const ROUNDED_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const appIconPath = path.join(
  __dirname,
  '..',
  '..',
  'Macra',
  'Macra',
  'Assets.xcassets',
  'AppIcon.appiconset',
  'AppIcon.png'
);
const appIconDataUri = `data:image/png;base64,${fs.readFileSync(appIconPath).toString('base64')}`;

const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="macraBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E9FF2D"/>
      <stop offset="58%" stop-color="#E0FE10"/>
      <stop offset="100%" stop-color="#C9F70D"/>
    </linearGradient>
    <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#789000" flood-opacity="0.26"/>
    </filter>
    <filter id="logoShadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="10" stdDeviation="11" flood-color="#6D8400" flood-opacity="0.24"/>
    </filter>
    <clipPath id="appIconClip">
      <rect x="0" y="0" width="68" height="68" rx="16" ry="16"/>
    </clipPath>
  </defs>

  <rect width="1200" height="630" fill="url(#macraBg)"/>

  <g transform="translate(90 210)" filter="url(#softShadow)">
    <circle cx="82" cy="86" r="62" fill="#F8FAFC" stroke="#2B2E21" stroke-width="8"/>
    <circle cx="82" cy="86" r="38" fill="#FFFFFF" stroke="#CAD2D9" stroke-width="6"/>
    <g fill="#2B2E21">
      <rect x="0" y="4" width="10" height="152" rx="5"/>
      <rect x="-9" y="4" width="5" height="52" rx="2.5"/>
      <rect x="3" y="4" width="5" height="52" rx="2.5"/>
      <rect x="15" y="4" width="5" height="52" rx="2.5"/>
      <rect x="27" y="4" width="5" height="52" rx="2.5"/>
      <path d="M178 0c20 27 20 72 3 101v55c0 8-6 14-14 14s-14-6-14-14V14c0-8 10-13 25-14Z"/>
    </g>
  </g>

  <g transform="translate(360 236)">
    <text x="0" y="0"
          font-family="${ROUNDED_FONT_STACK}"
          font-size="31"
          font-weight="900"
          fill="#050505"
          letter-spacing="0">YOU'RE INVITED</text>
    <text x="0" y="112"
          font-family="${ROUNDED_FONT_STACK}"
          font-size="96"
          font-weight="900"
          fill="#050505"
          letter-spacing="0">Eat With Me</text>
    <text x="4" y="178"
          font-family="${ROUNDED_FONT_STACK}"
          font-size="39"
          font-weight="800"
          fill="#050505"
          fill-opacity="0.78"
          letter-spacing="0">Share my eating habits</text>
  </g>

  <g transform="translate(88 530)" filter="url(#logoShadow)">
    <image href="${appIconDataUri}" x="0" y="0" width="68" height="68" clip-path="url(#appIconClip)" preserveAspectRatio="xMidYMid slice"/>
    <text x="86" y="47"
          font-family="${ROUNDED_FONT_STACK}"
          font-size="42"
          font-weight="900"
          fill="#050505"
          letter-spacing="0">Macra</text>
  </g>
</svg>`;

const outPath = path.join(__dirname, '..', 'public', 'preview', 'macra-buddy.png');
fs.mkdirSync(path.dirname(outPath), { recursive: true });

sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(outPath)
  .then((info) => {
    console.log(`✓ Wrote ${outPath} (${info.width}×${info.height}, ${info.size} bytes)`);
  })
  .catch((err) => {
    console.error('✗ Failed to render Macra buddy OG:', err);
    process.exit(1);
  });
