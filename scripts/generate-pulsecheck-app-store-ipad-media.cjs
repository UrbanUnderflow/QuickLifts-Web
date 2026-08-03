const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const CAPTURE_ROOT = path.resolve(ROOT, '..', 'PulseCheck', 'artifacts', 'app-store-screenshots-ipad-13');
const OUTPUT_ROOT = path.join(ROOT, 'public', 'pulsecheck-media');
const PREVIEW_ROOT = path.join(OUTPUT_ROOT, 'ipad-13');
const FULL_ROOT = path.join(OUTPUT_ROOT, 'full', 'ipad-13');
const DOWNLOAD_ROOT = path.join(OUTPUT_ROOT, 'PulseCheck-App-Store-iPad-13-Screenshots');
const ICON_PATH = path.join(ROOT, 'public', 'pulsecheck-app-icon.jpg');

const WIDTH = 2048;
const HEIGHT = 2732;
const IPAD = {
  x: 322,
  y: 820,
  width: 1404,
  height: 1872,
  inset: 20,
  radius: 64,
};

const screens = [
  {
    slug: 'appstore-ipad-01-daily-skills',
    source: '01-daily-command-center.png',
    eyebrow: 'DAILY MENTAL SKILLS TRAINING',
    headline: ['Train your mind.', 'Use it in the game.'],
    subcopy: ['Check in. Get three skills.', 'Practice what matters today.'],
    artWord: 'READY',
    accent: '#D8FF3E',
    accent2: '#48E5C2',
    glow: '#C8FF4A',
    label: '01 / TODAY',
    proof: 'THREE SKILLS · ONE CLEAR PLAN',
  },
  {
    slug: 'appstore-ipad-02-training-system',
    source: '03-training-hub.png',
    eyebrow: 'YOUR TRAINING SYSTEM',
    headline: ['Your training.', 'Built for today.'],
    subcopy: ['See the rep, why it was chosen,', 'and what comes next.'],
    artWord: 'TRAIN',
    accent: '#A875FF',
    accent2: '#D8FF3E',
    glow: '#7C3AED',
    label: '02 / TRAIN',
    proof: '200+ MENTAL SKILLS',
  },
  {
    slug: 'appstore-ipad-03-box-breathing',
    source: '08-box-breathing.png',
    eyebrow: 'PRACTICE THE SKILL',
    headline: ['Slow the breath.', 'Own the next play.'],
    subcopy: ['Follow the count. Settle your body.', 'Return to what matters.'],
    artWord: 'BREATHE',
    accent: '#39E6D0',
    accent2: '#9B6BFF',
    glow: '#22D3EE',
    label: '03 / PRACTICE',
    proof: 'GUIDED BOX BREATHING',
  },
  {
    slug: 'appstore-ipad-04-nora-coaching',
    source: '02-ai-coaching.png',
    eyebrow: 'YOUR PRIVATE COACH',
    headline: ['Talk it through.', 'Leave with a plan.'],
    subcopy: ['Nora helps make sense of the moment,', 'then connects it to a skill.'],
    artWord: 'NORA',
    accent: '#D8FF3E',
    accent2: '#9B6BFF',
    glow: '#A855F7',
    label: '04 / COACH',
    proof: 'PRIVATE · PERSONAL · PRACTICAL',
  },
  {
    slug: 'appstore-ipad-05-program',
    source: '06-program.png',
    eyebrow: 'SEE THE PATTERN',
    headline: ['Know what you built.', 'See what opens next.'],
    subcopy: ['Follow your progress, current block,', 'and the next level of training.'],
    artWord: 'BUILD',
    accent: '#52E4CD',
    accent2: '#D8FF3E',
    glow: '#10B981',
    label: '05 / PROGRAM',
    proof: 'PROGRESS THAT KEEPS MOVING',
  },
  {
    slug: 'appstore-ipad-06-support-system',
    source: '07-conversations.png',
    eyebrow: 'YOUR SUPPORT SYSTEM',
    headline: ['Your people.', 'One clear place.'],
    subcopy: ['Keep Nora and your support team close.', 'Follow up when the moment is still fresh.'],
    artWord: 'TALK',
    accent: '#A875FF',
    accent2: '#48E5C2',
    glow: '#8B5CF6',
    label: '06 / SUPPORT',
    proof: 'COACHING THAT CONTINUES',
  },
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function dataUri(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

function linesSvg(lines, x, y, gap, attributes = '') {
  return lines
    .map((line, index) => `<text x="${x}" y="${y + index * gap}" ${attributes}>${escapeXml(line)}</text>`)
    .join('\n');
}

async function renderScreen(screen) {
  const sourcePath = path.join(CAPTURE_ROOT, screen.source);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing iPad capture: ${sourcePath}`);
  }

  const screenshot = dataUri(sourcePath);
  const icon = dataUri(ICON_PATH);
  const innerX = IPAD.x + IPAD.inset;
  const innerY = IPAD.y + IPAD.inset;
  const innerWidth = IPAD.width - IPAD.inset * 2;
  const innerHeight = IPAD.height - IPAD.inset * 2;
  const innerRadius = IPAD.radius - 20;

  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="${WIDTH}" y2="${HEIGHT}">
          <stop offset="0%" stop-color="#07080C"/>
          <stop offset="52%" stop-color="#0B0D13"/>
          <stop offset="100%" stop-color="#050609"/>
        </linearGradient>
        <radialGradient id="glowA" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${screen.glow}" stop-opacity="0.34"/>
          <stop offset="100%" stop-color="${screen.glow}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glowB" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${screen.accent2}" stop-opacity="0.21"/>
          <stop offset="100%" stop-color="${screen.accent2}" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="accentLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${screen.accent}"/>
          <stop offset="100%" stop-color="${screen.accent2}"/>
        </linearGradient>
        <linearGradient id="bezel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#343844"/>
          <stop offset="35%" stop-color="#101116"/>
          <stop offset="100%" stop-color="#272A33"/>
        </linearGradient>
        <pattern id="grid" width="92" height="92" patternUnits="userSpaceOnUse">
          <path d="M 92 0 L 0 0 0 92" fill="none" stroke="#FFFFFF" stroke-opacity="0.035" stroke-width="1"/>
        </pattern>
        <clipPath id="iconClip">
          <rect x="104" y="76" width="68" height="68" rx="18"/>
        </clipPath>
        <clipPath id="screenClip">
          <rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}" rx="${innerRadius}"/>
        </clipPath>
        <filter id="ipadShadow" x="-30%" y="-20%" width="160%" height="180%">
          <feDropShadow dx="0" dy="44" stdDeviation="58" flood-color="${screen.glow}" flood-opacity="0.17"/>
          <feDropShadow dx="0" dy="26" stdDeviation="42" flood-color="#000000" flood-opacity="0.76"/>
        </filter>
        <filter id="softBlur">
          <feGaussianBlur stdDeviation="56"/>
        </filter>
      </defs>

      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#background)"/>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>
      <ellipse cx="1780" cy="380" rx="760" ry="600" fill="url(#glowA)"/>
      <ellipse cx="120" cy="1900" rx="650" ry="820" fill="url(#glowB)"/>
      <circle cx="1710" cy="2300" r="360" fill="${screen.accent}" opacity="0.052" filter="url(#softBlur)"/>

      <text x="1900" y="780" text-anchor="end"
        font-family="Arial, Helvetica, sans-serif" font-size="260" font-weight="900"
        letter-spacing="-15" fill="#FFFFFF" opacity="0.035">${escapeXml(screen.artWord)}</text>

      <image href="${icon}" x="104" y="76" width="68" height="68" clip-path="url(#iconClip)"/>
      <text x="196" y="124" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif"
        font-size="38" font-weight="800" letter-spacing="-1">PulseCheck</text>
      <text x="1938" y="119" text-anchor="end" fill="#FFFFFF" opacity="0.42"
        font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700"
        letter-spacing="4">${escapeXml(screen.label)}</text>

      <rect x="104" y="198" width="112" height="6" rx="3" fill="url(#accentLine)"/>
      <text x="104" y="260" fill="${screen.accent}" font-family="Arial, Helvetica, sans-serif"
        font-size="25" font-weight="900" letter-spacing="5.5">${escapeXml(screen.eyebrow)}</text>

      ${linesSvg(
        screen.headline,
        96,
        390,
        136,
        'fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="126" font-weight="800" letter-spacing="-6.5"'
      )}

      ${linesSvg(
        screen.subcopy,
        104,
        668,
        45,
        'fill="#FFFFFF" fill-opacity="0.67" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="500" letter-spacing="-0.8"'
      )}

      <g transform="translate(1380 690)">
        <rect width="540" height="66" rx="33" fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-opacity="0.11"/>
        <circle cx="34" cy="33" r="9" fill="${screen.accent}"/>
        <text x="64" y="42" fill="#FFFFFF" fill-opacity="0.72"
          font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="800"
          letter-spacing="2.4">${escapeXml(screen.proof)}</text>
      </g>

      <g filter="url(#ipadShadow)">
        <rect x="${IPAD.x - 6}" y="${IPAD.y - 6}" width="${IPAD.width + 12}" height="${IPAD.height + 12}"
          rx="${IPAD.radius + 6}" fill="url(#accentLine)" opacity="0.68"/>
        <rect x="${IPAD.x}" y="${IPAD.y}" width="${IPAD.width}" height="${IPAD.height}"
          rx="${IPAD.radius}" fill="url(#bezel)"/>
        <rect x="${IPAD.x + 8}" y="${IPAD.y + 8}" width="${IPAD.width - 16}" height="${IPAD.height - 16}"
          rx="${IPAD.radius - 8}" fill="#050608" stroke="#FFFFFF" stroke-opacity="0.11" stroke-width="2"/>
        <image href="${screenshot}" x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}"
          preserveAspectRatio="xMidYMid slice" clip-path="url(#screenClip)"/>
        <rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}"
          rx="${innerRadius}" fill="none" stroke="#FFFFFF" stroke-opacity="0.1" stroke-width="2"/>
        <circle cx="${IPAD.x + IPAD.width / 2}" cy="${IPAD.y + 13}" r="5" fill="#172235"/>
      </g>

      <rect x="0" y="${HEIGHT - 12}" width="${WIDTH}" height="12" fill="url(#accentLine)"/>
    </svg>
  `;

  const fullPath = path.join(FULL_ROOT, `${screen.slug}.png`);
  const previewPath = path.join(PREVIEW_ROOT, `${screen.slug}.png`);
  const downloadPath = path.join(DOWNLOAD_ROOT, `${screen.slug}.png`);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(fullPath);
  await sharp(fullPath).resize({ width: 768 }).png({ compressionLevel: 9 }).toFile(previewPath);
  fs.copyFileSync(fullPath, downloadPath);

  const meta = await sharp(fullPath).metadata();
  console.log(`${path.basename(fullPath)}  ${meta.width}x${meta.height}`);
}

function buildArchive() {
  const archivePath = path.join(OUTPUT_ROOT, 'PulseCheck-App-Store-iPad-13-Screenshots.zip');
  const files = screens.map((screen) => path.join(DOWNLOAD_ROOT, `${screen.slug}.png`));
  execFileSync('zip', ['-j', '-9', '-FS', archivePath, ...files], { stdio: 'ignore' });
}

async function main() {
  fs.mkdirSync(PREVIEW_ROOT, { recursive: true });
  fs.mkdirSync(FULL_ROOT, { recursive: true });
  fs.mkdirSync(DOWNLOAD_ROOT, { recursive: true });
  for (const screen of screens) {
    await renderScreen(screen);
  }
  buildArchive();
  console.log('PulseCheck iPad 13-inch App Store media set generated.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
