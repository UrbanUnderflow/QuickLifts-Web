// Parses the real FWP MuscleAtlas.swift polyline data and emits faithful SVG
// <path> markup for the male front (and back) body, colored by recovery exactly
// as the app's PulseTheme.recoveryColor blend does.
const fs = require('fs');
const path = require('path');

const ATLAS = '/Users/tremainegrant/Documents/GitHub/FWP/FWP/Views/MuscleAtlas.swift';
const src = fs.readFileSync(ATLAS, 'utf8');

// recovery values matching BodyHeatMapCard.swift preview
const RECOVERY = {
  shoulders: 0.55, chest: 0.25, arms: 0.40, core: 0.90, quads: 0.95, calves: 0.80,
  // back
  traps: 0.50, back: 0.30, glutes: 0.92, hamstrings: 0.88,
};

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const FAT = hex(0xFF5A4D), REC = hex(0xFFB23E), FRESH = hex(0xE0FE10);
const blend = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
function recColor(v) {
  v = Math.min(1, Math.max(0, v));
  const rgb = v < 0.5 ? blend(FAT, REC, v / 0.5) : blend(REC, FRESH, (v - 0.5) / 0.5);
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

// grab a body block: static let <name> = AtlasBody(viewW: N, viewH: N, muscles: [ ... ])
function body(name) {
  const start = src.indexOf(`static let ${name} = AtlasBody(`);
  if (start < 0) throw new Error('not found: ' + name);
  const head = src.slice(start, start + 200);
  const vw = +/viewW:\s*(\d+)/.exec(head)[1];
  const vh = +/viewH:\s*(\d+)/.exec(head)[1];
  // muscles array up to the matching "])" — scan for the next standalone "])"
  const arrStart = src.indexOf('muscles: [', start) + 'muscles: ['.length;
  let depth = 1, i = arrStart;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '[') depth++;
    else if (c === ']') depth--;
    i++;
  }
  const block = src.slice(arrStart, i - 1);
  const muscles = [];
  const re = /AtlasMuscle\(slug:\s*"([^"]*)",\s*region:\s*"([^"]*)",\s*encoded:\s*"([^"]*)"\)/g;
  let m;
  while ((m = re.exec(block))) muscles.push({ slug: m[1], region: m[2], encoded: m[3] });
  return { vw, vh, muscles };
}

function toPathD(encoded) {
  return encoded.split(';').map((sub) => {
    const pts = sub.trim().split(/\s+/).filter(Boolean);
    let d = '';
    pts.forEach((tok, idx) => {
      const [x, y] = tok.split(',');
      if (x === undefined || y === undefined) return;
      d += (idx === 0 ? 'M' : 'L') + x + ',' + y;
    });
    return d ? d + 'Z' : '';
  }).join('');
}

function svg(b) {
  let paths = '';
  for (const mu of b.muscles) {
    const d = toPathD(mu.encoded);
    if (!d) continue;
    const fill = mu.region && mu.region in RECOVERY ? recColor(RECOVERY[mu.region]) : 'rgba(255,255,255,0.08)';
    paths += `<path d="${d}" fill="${fill}" stroke="rgba(0,0,0,0.32)" stroke-width="0.8"/>`;
  }
  return `<svg viewBox="0 0 ${b.vw} ${b.vh}" xmlns="http://www.w3.org/2000/svg" data-w="${b.vw}" data-h="${b.vh}">${paths}</svg>`;
}

const front = body('maleFront');
const out = svg(front);
const dest = path.join(__dirname, 'bodymap-front.svg');
fs.writeFileSync(dest, out);
console.log(`maleFront: ${front.muscles.length} muscles, ${out.length} bytes → ${dest}`);
console.log('regions:', [...new Set(front.muscles.map(m => m.region).filter(Boolean))].join(', '));
