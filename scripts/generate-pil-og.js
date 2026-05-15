/* eslint-disable */
// One-off script: render the Pulse Intelligence Labs OG image at
// /public/pil-og.png (1200×630). Uses /public/pil-og-source.jpg as the
// background photo and composites a dark cinematic overlay + the PIL
// wordmark "The Human Performance Company" on top.
//
// Run locally on macOS so sharp/librsvg can pick up real system fonts
// (SF Pro, Helvetica). Ship the resulting PNG alongside the meta tags.
//
// Usage:  node scripts/generate-pil-og.js
// Swap source: drop a different 1200×630-ish photo at public/pil-og-source.jpg
//              and re-run.

const path = require('path');
const fs = require('fs');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

const WIDTH = 1200;
const HEIGHT = 630;

const SOURCE = path.join(__dirname, '..', 'public', 'pil-og-source.jpg');
const OUT = path.join(__dirname, '..', 'public', 'pil-og.png');

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif";

// Dark cinematic overlay: heavier on the bottom-left where the text sits,
// fades toward the upper-right so the subject still reads through.
const overlaySVG = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="darkWash" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%"  stop-color="#000000" stop-opacity="0.92"/>
      <stop offset="45%" stop-color="#000000" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.25"/>
    </linearGradient>
    <linearGradient id="bottomFade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%"  stop-color="#000000" stop-opacity="0"/>
      <stop offset="60%" stop-color="#000000" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
    </radialGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#darkWash)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bottomFade)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/>
</svg>`;

// Brand color wash — very subtle PIL signature gradient sitting on top of
// the dark overlay. Multiply blend mode would be ideal but sharp uses
// 'over' compositing, so we just keep alpha low and let it tint.
const brandWashSVG = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="brandTint" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#E0FE10" stop-opacity="0.08"/>
      <stop offset="50%"  stop-color="#A05EF8" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#5EEAD4" stop-opacity="0.06"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#brandTint)"/>
</svg>`;

// Foreground text — small wordmark up top, big "PIL" headline, tagline.
const textSVG = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="pilGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#FFFFFF"/>
      <stop offset="50%"  stop-color="#E0FE10"/>
      <stop offset="100%" stop-color="#5EEAD4"/>
    </linearGradient>
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="14" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Top wordmark -->
  <g transform="translate(64, 64)">
    <circle cx="6" cy="6" r="5" fill="#E0FE10"/>
    <text x="22" y="11"
          font-family="${FONT_STACK}"
          font-size="20"
          font-weight="700"
          fill="#FFFFFF"
          letter-spacing="4">PULSE INTELLIGENCE LABS</text>
  </g>

  <!-- Hero "PIL" mark -->
  <text x="64" y="430"
        font-family="${FONT_STACK}"
        font-size="280"
        font-weight="800"
        fill="url(#pilGradient)"
        letter-spacing="-6"
        filter="url(#softShadow)">PIL</text>

  <!-- Tagline -->
  <text x="64" y="498"
        font-family="${FONT_STACK}"
        font-size="44"
        font-weight="600"
        fill="#FFFFFF"
        letter-spacing="-0.5">The Human Performance Company.</text>

  <!-- Subline -->
  <text x="64" y="548"
        font-family="${FONT_STACK}"
        font-size="22"
        font-weight="500"
        fill="#A1A1AA"
        letter-spacing="0.2">An AI lab for training, nutrition, mindset, and ritual.</text>

  <!-- URL pill bottom-right -->
  <g transform="translate(${WIDTH - 318}, ${HEIGHT - 88})">
    <rect x="0" y="0" rx="22" ry="22" width="254" height="44"
          fill="#FFFFFF" fill-opacity="0.1"
          stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="1"/>
    <text x="127" y="28"
          font-family="${FONT_STACK}"
          font-size="16"
          font-weight="600"
          fill="#FFFFFF"
          text-anchor="middle"
          letter-spacing="1">pulseintelligencelabs.com</text>
  </g>
</svg>`;

async function generate() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(
      `Missing source image: ${SOURCE}. Drop a 1200×630-ish photo there and re-run.`,
    );
  }

  // Resize the background to cover 1200×630 (center-crop), then slightly
  // darken it before compositing the overlays.
  const background = await sharp(SOURCE)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'center' })
    .modulate({ brightness: 0.85, saturation: 1.05 })
    .toBuffer();

  const info = await sharp(background)
    .composite([
      { input: Buffer.from(overlaySVG), top: 0, left: 0 },
      { input: Buffer.from(brandWashSVG), top: 0, left: 0 },
      { input: Buffer.from(textSVG), top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9, quality: 92 })
    .toFile(OUT);

  console.log(`✓ Wrote ${OUT} (${info.width}×${info.height}, ${info.size} bytes)`);
}

generate().catch((err) => {
  console.error('✗ Failed to render PIL OG:', err);
  process.exit(1);
});
