const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const CAPTURE_ROOT = path.resolve(ROOT, '..', 'PulseCheck', 'artifacts', 'app-store-screenshots');
const OUTPUT_ROOT = path.join(ROOT, 'public', 'pulsecheck-media');
const FULL_ROOT = path.join(OUTPUT_ROOT, 'full');
const ICON_PATH = path.join(ROOT, 'public', 'pulsecheck-app-icon.jpg');

const WIDTH = 1284;
const HEIGHT = 2778;
const PHONE = {
  x: 214,
  y: 955,
  width: 856,
  height: 1862,
  inset: 24,
  radius: 106,
};

const screens = [
  {
    slug: 'appstore-01-daily-skills',
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
    slug: 'appstore-02-training-system',
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
    slug: 'appstore-03-box-breathing',
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
    slug: 'appstore-04-nora-coaching',
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
    slug: 'appstore-05-program',
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
    slug: 'appstore-06-support-system',
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

function linesSvg(lines, x, y, size, gap, attributes = '') {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * gap}" ${attributes}>${escapeXml(line)}</text>`
    )
    .join('\n');
}

async function renderScreen(screen) {
  const sourcePath = path.join(CAPTURE_ROOT, screen.source);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing capture: ${sourcePath}`);
  }

  const screenshot = dataUri(sourcePath);
  const icon = dataUri(ICON_PATH);
  const innerX = PHONE.x + PHONE.inset;
  const innerY = PHONE.y + PHONE.inset;
  const innerWidth = PHONE.width - PHONE.inset * 2;
  const innerHeight = PHONE.height - PHONE.inset * 2;
  const innerRadius = PHONE.radius - 24;

  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="${WIDTH}" y2="${HEIGHT}">
          <stop offset="0%" stop-color="#07080C"/>
          <stop offset="52%" stop-color="#0B0D13"/>
          <stop offset="100%" stop-color="#050609"/>
        </linearGradient>
        <radialGradient id="glowA" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${screen.glow}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${screen.glow}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glowB" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${screen.accent2}" stop-opacity="0.22"/>
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
        <pattern id="grid" width="74" height="74" patternUnits="userSpaceOnUse">
          <path d="M 74 0 L 0 0 0 74" fill="none" stroke="#FFFFFF" stroke-opacity="0.035" stroke-width="1"/>
        </pattern>
        <clipPath id="iconClip">
          <rect x="78" y="71" width="58" height="58" rx="15"/>
        </clipPath>
        <clipPath id="screenClip">
          <rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}" rx="${innerRadius}"/>
        </clipPath>
        <filter id="phoneShadow" x="-40%" y="-20%" width="180%" height="180%">
          <feDropShadow dx="0" dy="42" stdDeviation="52" flood-color="${screen.glow}" flood-opacity="0.18"/>
          <feDropShadow dx="0" dy="24" stdDeviation="36" flood-color="#000000" flood-opacity="0.72"/>
        </filter>
        <filter id="softBlur">
          <feGaussianBlur stdDeviation="48"/>
        </filter>
      </defs>

      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#background)"/>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>
      <ellipse cx="1140" cy="430" rx="520" ry="500" fill="url(#glowA)"/>
      <ellipse cx="55" cy="1720" rx="470" ry="700" fill="url(#glowB)"/>
      <circle cx="1100" cy="2320" r="260" fill="${screen.accent}" opacity="0.055" filter="url(#softBlur)"/>

      <text x="1190" y="830" text-anchor="end"
        font-family="Arial, Helvetica, sans-serif" font-size="232" font-weight="900"
        letter-spacing="-14" fill="#FFFFFF" opacity="0.035">${escapeXml(screen.artWord)}</text>

      <image href="${icon}" x="78" y="71" width="58" height="58" clip-path="url(#iconClip)"/>
      <text x="156" y="110" fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif"
        font-size="30" font-weight="800" letter-spacing="-0.8">PulseCheck</text>
      <text x="1168" y="107" text-anchor="end" fill="#FFFFFF" opacity="0.42"
        font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700"
        letter-spacing="3">${escapeXml(screen.label)}</text>

      <rect x="78" y="202" width="88" height="5" rx="2.5" fill="url(#accentLine)"/>
      <text x="78" y="267" fill="${screen.accent}" font-family="Arial, Helvetica, sans-serif"
        font-size="20" font-weight="900" letter-spacing="4.5">${escapeXml(screen.eyebrow)}</text>

      ${linesSvg(
        screen.headline,
        72,
        402,
        116,
        124,
        'fill="#FFFFFF" font-family="Arial, Helvetica, sans-serif" font-size="116" font-weight="800" letter-spacing="-6.2"'
      )}

      ${linesSvg(
        screen.subcopy,
        79,
        712,
        34,
        46,
        'fill="#FFFFFF" fill-opacity="0.67" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="500" letter-spacing="-0.8"'
      )}

      <g transform="translate(78 838)">
        <rect width="382" height="62" rx="31" fill="#FFFFFF" fill-opacity="0.06" stroke="#FFFFFF" stroke-opacity="0.11"/>
        <circle cx="31" cy="31" r="8" fill="${screen.accent}"/>
        <text x="55" y="39" fill="#FFFFFF" fill-opacity="0.72"
          font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="800"
          letter-spacing="2.1">${escapeXml(screen.proof)}</text>
      </g>

      <g filter="url(#phoneShadow)">
        <rect x="${PHONE.x - 5}" y="${PHONE.y - 5}" width="${PHONE.width + 10}" height="${PHONE.height + 10}"
          rx="${PHONE.radius + 5}" fill="url(#accentLine)" opacity="0.65"/>
        <rect x="${PHONE.x}" y="${PHONE.y}" width="${PHONE.width}" height="${PHONE.height}"
          rx="${PHONE.radius}" fill="url(#bezel)"/>
        <rect x="${PHONE.x + 8}" y="${PHONE.y + 8}" width="${PHONE.width - 16}" height="${PHONE.height - 16}"
          rx="${PHONE.radius - 8}" fill="#050608" stroke="#FFFFFF" stroke-opacity="0.11" stroke-width="2"/>
        <image href="${screenshot}" x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}"
          preserveAspectRatio="xMidYMid slice" clip-path="url(#screenClip)"/>
        <rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}"
          rx="${innerRadius}" fill="none" stroke="#FFFFFF" stroke-opacity="0.1" stroke-width="2"/>
        <rect x="${PHONE.x + PHONE.width / 2 - 104}" y="${PHONE.y + 25}" width="208" height="54" rx="27" fill="#020204"/>
        <circle cx="${PHONE.x + PHONE.width / 2 + 71}" cy="${PHONE.y + 52}" r="8" fill="#172235"/>
      </g>

      <rect x="0" y="${HEIGHT - 11}" width="${WIDTH}" height="11" fill="url(#accentLine)"/>
    </svg>
  `;

  const fullPath = path.join(FULL_ROOT, `${screen.slug}.png`);
  const previewPath = path.join(OUTPUT_ROOT, `${screen.slug}.png`);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(fullPath);
  await sharp(fullPath).resize({ width: 642 }).png({ compressionLevel: 9 }).toFile(previewPath);

  const meta = await sharp(fullPath).metadata();
  console.log(`${path.basename(fullPath)}  ${meta.width}x${meta.height}`);
}

async function buildContactSheet() {
  const thumbWidth = 321;
  const thumbHeight = Math.round((HEIGHT / WIDTH) * thumbWidth);
  const gap = 26;
  const margin = 42;
  const canvasWidth = margin * 2 + thumbWidth * 3 + gap * 2;
  const canvasHeight = margin * 2 + thumbHeight * 2 + gap;

  const composites = [];
  for (let index = 0; index < screens.length; index += 1) {
    const input = path.join(FULL_ROOT, `${screens[index].slug}.png`);
    const buffer = await sharp(input).resize(thumbWidth, thumbHeight).png().toBuffer();
    composites.push({
      input: buffer,
      left: margin + (index % 3) * (thumbWidth + gap),
      top: margin + Math.floor(index / 3) * (thumbHeight + gap),
    });
  }

  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: '#050609',
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUTPUT_ROOT, 'appstore-contact-sheet.png'));
}

function buildArchive() {
  const archivePath = path.join(OUTPUT_ROOT, 'PulseCheck-App-Store-6.5-Screenshots.zip');
  const files = screens.map((screen) => path.join(FULL_ROOT, `${screen.slug}.png`));
  execFileSync('zip', ['-j', '-9', '-FS', archivePath, ...files], {
    stdio: 'ignore',
  });
}

async function main() {
  fs.mkdirSync(FULL_ROOT, { recursive: true });
  for (const screen of screens) {
    await renderScreen(screen);
  }
  await buildContactSheet();
  buildArchive();
  console.log('PulseCheck App Store media set generated.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
