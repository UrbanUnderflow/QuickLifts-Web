/* eslint-disable */
// One-off script: render the PulseCheck splash to a static PNG at
// /public/pulsecheck-og.png. Mirrors scripts/generate-pil-og.js so the
// /PulseCheck route has a matching-style preview image with its own wordmark.
// Run locally on macOS so sharp/librsvg can pick up real system fonts
// (SF Pro, Helvetica).
//
// Usage: node scripts/generate-pulsecheck-og.js

const path = require('path');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

const ROUNDED_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050608"/>
      <stop offset="55%" stop-color="#0A0A0B"/>
      <stop offset="100%" stop-color="#101218"/>
    </linearGradient>
    <linearGradient id="wordmark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#DFFD10"/>
    </linearGradient>
    <radialGradient id="orbGreen" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#DFFD10" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#DFFD10" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbBlue" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#007AFF" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#007AFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbPurple" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#8A2BE2" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="#8A2BE2" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbRed" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#EF4444" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#EF4444" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>

  <ellipse cx="170" cy="110" rx="340" ry="340" fill="url(#orbGreen)"/>
  <ellipse cx="1060" cy="180" rx="300" ry="300" fill="url(#orbBlue)"/>
  <ellipse cx="980" cy="560" rx="280" ry="280" fill="url(#orbPurple)"/>
  <ellipse cx="160" cy="540" rx="220" ry="220" fill="url(#orbRed)"/>

  <rect x="300" y="90" width="1" height="450" fill="#FFFFFF" opacity="0.05"/>
  <rect x="900" y="90" width="1" height="450" fill="#FFFFFF" opacity="0.06"/>

  <text x="600" y="320"
        font-family="${ROUNDED_FONT_STACK}"
        font-size="150"
        font-weight="900"
        fill="url(#wordmark)"
        text-anchor="middle"
        dominant-baseline="central"
        letter-spacing="4">Pulse Check</text>

  <text x="600" y="430"
        font-family="${ROUNDED_FONT_STACK}"
        font-size="26"
        font-weight="600"
        fill="#FFFFFF"
        fill-opacity="0.55"
        text-anchor="middle"
        letter-spacing="7">ALWAYS-ON SPORT PSYCHOLOGY</text>
</svg>`;

const outPath = path.join(__dirname, '..', 'public', 'pulsecheck-og.png');

sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile(outPath)
  .then((info) => {
    console.log(`✓ Wrote ${outPath} (${info.width}×${info.height}, ${info.size} bytes)`);
  })
  .catch((err) => {
    console.error('✗ Failed to render PulseCheck OG:', err);
    process.exit(1);
  });
