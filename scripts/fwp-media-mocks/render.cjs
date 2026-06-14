// Renders each FWP mock screen (#id divs in mocks.html) to PNG.
//   /public/fwp-media/<file>.png        gallery thumbnail  (2x)
//   /public/fwp-media/full/<file>.png   full-res download  (3x, normalized to App Store 1284x2778)
const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// App Store Connect 6.5" display portrait. Full-res downloads must land here so
// they upload without the "wrong dimensions" error.
const APP_STORE_W = 1284;
const APP_STORE_H = 2778;

const SCREENS = [
  ['appstore', '00-app-store-press-play'],
  ['today',    '01-today-home'],
  ['heatmap',  '02-recovery-heat-map'],
  ['preview',  '03-workout-preview-built-for-you'],
  ['player',   '04-immersive-player'],
  ['progress', '05-progress-rank'],
  ['movers',   '06-find-movers'],
  ['profile',  '07-me-profile'],
];

// Build mocks.html → _mocks.built.html, injecting the real MuscleAtlas SVG
// (extracted by extract-bodymap.cjs) into the __BODYMAP_FRONT__ token. Kept in
// the same dir so relative asset paths (../../public/...) still resolve.
const BUILT = path.join(__dirname, '_mocks.built.html');
(function build() {
  let html = fs.readFileSync(path.join(__dirname, 'mocks.html'), 'utf8');
  const svgPath = path.join(__dirname, 'bodymap-front.svg');
  let svg = fs.readFileSync(svgPath, 'utf8');
  svg = svg.replace('<svg ', '<svg height="330" ');
  html = html.replace('__BODYMAP_FRONT__', svg);
  fs.writeFileSync(BUILT, html);
})();

const FILE = 'file://' + BUILT;
const OUT = path.join(__dirname, '..', '..', 'public', 'fwp-media');

async function shoot(scale, dir, exact) {
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
