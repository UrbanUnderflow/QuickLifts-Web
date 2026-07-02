const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = 'file://' + path.join(__dirname, 'mocks.html');
const OUT = path.join(ROOT, 'F6-PulseCheck-product-images');

const CARDS = [
  ['cover', '01-pulsecheck-lab-human-performance'],
  ['readiness', '02-pulsecheck-readiness-engine'],
  ['nora', '03-pulsecheck-nora-ai-coach'],
  ['wearables', '04-pulsecheck-wearable-context'],
  ['training', '05-pulsecheck-mental-training-protocol'],
];

fs.mkdirSync(OUT, { recursive: true });

async function render() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1300, height: 760 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(FILE, { waitUntil: 'networkidle' });

  for (const [id, slug] of CARDS) {
    const locator = page.locator(`#${id}`);
    const pngPath = path.join(OUT, `${slug}.png`);
    const jpgPath = path.join(OUT, `${slug}.jpg`);
    const buffer = await locator.screenshot();
    await sharp(buffer).resize(1200, 675, { fit: 'cover' }).png().toFile(pngPath);
    await sharp(buffer)
      .resize(1200, 675, { fit: 'cover' })
      .flatten({ background: '#07090b' })
      .jpeg({ quality: 92, mozjpeg: true })
      .toFile(jpgPath);
    console.log(`${slug}.png`);
    console.log(`${slug}.jpg`);
  }

  const thumbs = await Promise.all(CARDS.map(async ([, slug]) => {
    return sharp(path.join(OUT, `${slug}.jpg`)).resize(480, 270).toBuffer();
  }));

  await sharp({
    create: {
      width: 1000,
      height: 858,
      channels: 3,
      background: '#f4f5f7',
    },
  })
    .composite(thumbs.map((input, index) => ({
      input,
      left: index % 2 === 0 ? 20 : 500,
      top: 20 + Math.floor(index / 2) * 286,
    })))
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(path.join(OUT, '_contact-sheet.jpg'));

  await browser.close();
}

render().catch((error) => {
  console.error(error);
  process.exit(1);
});
