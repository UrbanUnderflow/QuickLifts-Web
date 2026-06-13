// Renders each FWP mock screen (#id divs in mocks.html) to PNG.
//   /public/fwp-media/<file>.png        gallery thumbnail  (2x)
//   /public/fwp-media/full/<file>.png   full-res download  (3x)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

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

async function shoot(scale, dir) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: 'networkidle' });
  for (const [id, file] of SCREENS) {
    const el = page.locator('#' + id);
    await el.screenshot({ path: path.join(dir, file + '.png') });
    console.log(`  ${scale}x  ${file}.png`);
  }
  await browser.close();
}

(async () => {
  console.log('Gallery (2x):');
  await shoot(2, OUT);
  console.log('Full-res (3x):');
  await shoot(3, path.join(OUT, 'full'));
  console.log('Done — ' + SCREENS.length + ' screens.');
})();
