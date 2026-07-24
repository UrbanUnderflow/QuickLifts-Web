// Normalizes the full-res media screenshots to a valid App Store Connect size.
// App Store 6.5" display accepts 1242x2688 or 1284x2778 (portrait). We target
// 1284x2778 to match the existing redesign-mocks/appstore/ set.
//
//   public/fwp-media/full/*.png       -> 1284x2778
//   public/fitclub-media/full/*.png   -> 1284x2778
//   public/pulsecheck-media/full/*.png -> 1284x2778
//
// Portrait shots (aspect within 10% of target) are cover-cropped from the top
// (no distortion, trims a sliver of edge). Off-aspect shots are letterboxed on
// black so they stay viewable instead of being badly stretched.
//
// Usage:  node scripts/normalize-appstore-screens.cjs
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const W = 1284;
const H = 2778;
const TARGET_RATIO = W / H;
const ASPECT_TOLERANCE = 0.1; // 10%

const DIRS = [
  path.join(__dirname, '..', 'public', 'fwp-media', 'full'),
  path.join(__dirname, '..', 'public', 'fitclub-media', 'full'),
  path.join(__dirname, '..', 'public', 'pulsecheck-media', 'full'),
];

async function normalize(file) {
  const buf = fs.readFileSync(file);
  const meta = await sharp(buf).metadata();
  if (meta.width === W && meta.height === H) {
    console.log(`  ok    ${path.basename(file)} (already ${W}x${H})`);
    return;
  }
  const ratio = meta.width / meta.height;
  const offAspect = Math.abs(ratio / TARGET_RATIO - 1) > ASPECT_TOLERANCE;
  const fit = offAspect ? 'contain' : 'cover';
  const out = await sharp(buf)
    .resize(W, H, {
      fit,
      position: 'top',
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toBuffer();
  fs.writeFileSync(file, out);
  console.log(
    `  fix   ${path.basename(file)}  ${meta.width}x${meta.height} -> ${W}x${H}  (${fit}${offAspect ? ', letterboxed' : ''})`
  );
}

(async () => {
  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) {
      console.log(`skip (missing): ${dir}`);
      continue;
    }
    console.log(path.relative(path.join(__dirname, '..'), dir) + ':');
    const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'));
    for (const f of files) await normalize(path.join(dir, f));
  }
  console.log('Done.');
})();
