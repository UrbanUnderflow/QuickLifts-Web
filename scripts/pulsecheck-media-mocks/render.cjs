// Renders each PulseCheck mock screen (#id divs in mocks.html) to PNG.
//   /public/pulsecheck-media/<file>.png        gallery thumbnail  (2x)
//   /public/pulsecheck-media/full/<file>.png   full-res download  (3x, normalized to App Store 1284x2778)
const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// App Store Connect 6.5" display portrait. Full-res downloads must land here so
// they upload without the "wrong dimensions" error.
const APP_STORE_W = 1284;
const APP_STORE_H = 2778;

const SCREENS = [
  ['appstore',  '00-app-store-meet-nora'],
  ['today',     '01-today-checkin'],
  ['chat',      '02-nora-chat'],
  ['intel',     '03-sports-intel'],
  ['wearables', '04-connect-wearable'],
  ['training',  '05-training'],
  ['inbox',     '06-nora-inbox'],
  ['profile',   '07-profile-private'],
  ['boxbreathing','08-box-breathing'],
  ['critical',  '09-critical-signal'],
  ['welfare',   '10-welfare-check'],
];

const FILE = 'file://' + path.join(__dirname, 'mocks.html');
const OUT = path.join(__dirname, '..', '..', 'public', 'pulsecheck-media');

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

async function shoot(scale, dir, exact) {
  ensureDir(dir);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: 'networkidle' });
  for (const [id, file] of SCREENS) {
    const el = page.locator('#' + id);
    const dest = path.join(dir, file + '.png');
    if (exact) {
      // Cover-crop from the top to the exact App Store size (no distortion).
      const buf = await el.screenshot();
      await sharp(buf)
        .resize(APP_STORE_W, APP_STORE_H, { fit: 'cover', position: 'top' })
        .png()
        .toFile(dest);
    } else {
      await el.screenshot({ path: dest });
    }
    console.log(`  ${scale}x  ${file}.png`);
  }
  await browser.close();
}

(async () => {
  console.log('Gallery (2x):');
  await shoot(2, OUT);
  console.log(`Full-res (3x -> ${APP_STORE_W}x${APP_STORE_H}):`);
  await shoot(3, path.join(OUT, 'full'), true);
  console.log('Done — ' + SCREENS.length + ' screens.');
})();
