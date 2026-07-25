#!/usr/bin/env node

/*
 * Static copy check for QuickLifts-Web user-facing copy.
 *
 * Default:
 *   node scripts/check-pulsecheck-website-copy.cjs
 *
 * Audit current backlog:
 *   node scripts/check-pulsecheck-website-copy.cjs --audit
 *
 * Refresh known findings after intentional cleanup/review:
 *   node scripts/check-pulsecheck-website-copy.cjs --update-baseline
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');
const baselinePath = path.join(repoRoot, 'scripts', 'website_copy_baseline.json');

const sourceRoots = [
  path.join(repoRoot, 'src', 'pages'),
  path.join(repoRoot, 'src', 'components'),
  path.join(repoRoot, 'src', 'content'),
  path.join(repoRoot, 'src', 'data'),
];

const sourceSuffixes = new Set(['.ts', '.tsx', '.js', '.jsx']);

const bannedPatterns = [
  ['cue', /\bcues?\b/i, 'Say the actual thing the athlete should notice or do.'],
  ['rep', /\breps?\b|\brepetition\b/i, 'Use practice, try, round, play, or session.'],
  ['baseline', /\bbaseline\b/i, 'Use starting point or starting check.'],
  ['state', /\bstate\b/i, 'Name the feeling, energy, focus, or body response.'],
  ['signal', /\bsignals?\b/i, 'Name the target, choice, reading, or check-in.'],
  ['fidelity', /\bfidelity\b/i, 'Use accuracy, clarity, or how well they did it.'],
  ['deploy', /\bdeploy(?:ed|s|ing)?\b/i, 'Use use, start, or bring into the moment.'],
  ['downregulate', /\bdownregulate\b/i, 'Use slow your body down or calm your body.'],
  ['upregulate', /\bupregulate\b/i, 'Use wake your body up or bring your energy up.'],
  ['cadence', /\bcadence\b/i, 'Use rhythm or count.'],
  ['stimulus', /\bstimulus\b/i, 'Use target, shape, color, or item on screen.'],
  ['carry-forward', /\bcarry-forward\b/i, 'Use next action or what you will use next.'],
  ['read the cue', /\bread the (?:complete )?cue\b/i, 'Tell the athlete exactly what to wait for or tap.'],
  ['read the signal', /\bread the signal\b/i, 'Tell the athlete exactly what to wait for or tap.'],
  ['read the state', /\bread the state\b/i, 'Use check what is true or notice how you feel.'],
  ['state on demand', /\bstate on demand\b/i, 'Use return to focus when you need it.'],
  ['shift your state', /\bshift your state\b/i, 'Use calm down or wake up.'],
  ['regulate your system', /\bregulate your system\b/i, 'Use slow your body down or steady your breathing.'],
  ['access your focus', /\baccess your focus\b/i, 'Use return to focus.'],
  ['recognize your pattern', /\brecognize your pattern\b/i, 'Name the actual pattern.'],
  ['create it on purpose', /\bcreate it on purpose\b/i, 'Name the action they should take.'],
  ['prepare the pathway', /\bprepare the pathway\b/i, 'Name the practice or next step.'],
  ['environmental fidelity', /\benvironmental fidelity\b/i, 'Use more game noise or more pressure.'],
];

const visibleContextPattern = /\b(alt|aria-label|label|title|headline|body|message|detail|description|gain|unlock|prompt|placeholder|response|takeaway|science|examples|focus|protocol|simulation|type|small|strong|h[1-6]|p)\b/;
const skipLinePattern = /\b(className|style|key|id|href|src|import|export|interface|type\s+\w+\s*=|console\.|data-|useState<|useRef<|useMemo|useEffect|NonNullable<|set[A-Z])\b/;

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function walkFiles(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    return sourceSuffixes.has(path.extname(target)) ? [target] : [];
  }

  const results = [];
  for (const entry of fs.readdirSync(target)) {
    const child = path.join(target, entry);
    const childStat = fs.statSync(child);
    if (childStat.isDirectory()) {
      if (['node_modules', '.next', 'dist', 'build'].includes(entry)) continue;
      results.push(...walkFiles(child));
    } else if (sourceSuffixes.has(path.extname(child))) {
      results.push(child);
    }
  }
  return results;
}

function unescapeLiteral(raw) {
  return raw
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/`/g, '');
}

function isInternalText(text) {
  const value = normalizeText(text);
  if (!value || value.length <= 2) return true;
  if (/^[a-z0-9_.:/#@-]+$/i.test(value) && !/\s/.test(value)) return true;
  if (/^pc[a-z]-|^pcp-|^pcy-/.test(value)) return true;
  if (/^\$?\{.*\}$/.test(value)) return true;
  if (/^https?:\/\//.test(value)) return true;
  return false;
}

function extractQuotedText(line) {
  const values = [];
  const literalPattern = /(['"`])((?:\\.|(?!\1).)*)\1/g;
  let match;
  while ((match = literalPattern.exec(line)) !== null) {
    const literal = unescapeLiteral(match[2]);
    const before = line.slice(0, match.index);
    if (visibleContextPattern.test(before) || (/\s/.test(literal) && !skipLinePattern.test(line))) {
      values.push(literal);
    }
  }
  return values;
}

function extractJsxText(line) {
  if (!/<\/?[A-Za-z][A-Za-z0-9.:-]*(\s|>|\/)/.test(line)) {
    return [];
  }

  if (skipLinePattern.test(line) && !/<(h[1-6]|p|span|small|strong|em|button)\b/.test(line)) {
    return [];
  }

  const withoutExpressions = line.replace(/\{[^{}]*\}/g, ' ');
  const text = normalizeText(withoutExpressions.replace(/<[^>]+>/g, ' '));
  if (!text || text === '/' || !/[A-Za-z]/.test(text)) return [];
  if (text.includes('=>') || text.includes('function ') || text.includes('return (')) return [];
  return [text];
}

function findingKey(finding) {
  const digest = crypto
    .createHash('sha1')
    .update(`${finding.rule}\0${normalizeText(finding.text)}`)
    .digest('hex')
    .slice(0, 12);
  return `${finding.file}:${finding.rule}:${digest}`;
}

function scanFile(file) {
  const relative = path.relative(repoRoot, file);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const findings = [];
  let insideStyleBlock = false;

  lines.forEach((line, index) => {
    if (line.includes('<style')) {
      insideStyleBlock = true;
    }
    if (insideStyleBlock) {
      if (line.includes('</style>')) insideStyleBlock = false;
      return;
    }

    const stripped = line.trim();
    if (!stripped || stripped.startsWith('//')) return;

    const candidates = [...extractQuotedText(line), ...extractJsxText(line)];
    for (const candidate of candidates) {
      const text = normalizeText(candidate);
      if (isInternalText(text)) continue;

      for (const [rule, pattern, suggestion] of bannedPatterns) {
        if (!pattern.test(text)) continue;
        findings.push({
          file: relative,
          line: index + 1,
          rule,
          text,
          suggestion,
        });
      }
    }
  });

  return findings;
}

function loadBaseline() {
  if (!fs.existsSync(baselinePath)) return new Set();
  const payload = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  return new Set(payload.allowedFindings || []);
}

function writeBaseline(findings) {
  const payload = {
    description: 'Known QuickLifts-Web copy findings. Run npm run copy:voice:audit to inspect them, then remove entries as copy is cleaned.',
    allowedFindings: [...new Set(findings.map(findingKey))].sort(),
  };
  fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function formatFinding(finding) {
  return `${finding.file}:${finding.line}: ${finding.rule}\n  ${finding.text}\n  Suggestion: ${finding.suggestion}`;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const audit = args.has('--audit');
  const updateBaseline = args.has('--update-baseline');
  const files = sourceRoots.flatMap(walkFiles);
  const findings = files.flatMap(scanFile).sort((a, b) => {
    return a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule);
  });

  if (updateBaseline) {
    writeBaseline(findings);
    console.log(`Updated ${path.relative(repoRoot, baselinePath)} with ${new Set(findings.map(findingKey)).size} known findings.`);
    return 0;
  }

  const baseline = loadBaseline();
  const activeFindings = audit ? findings : findings.filter((finding) => !baseline.has(findingKey(finding)));

  if (activeFindings.length === 0) {
    console.log(`QuickLifts-Web voice copy check passed: 0 ${audit ? 'findings' : 'new findings'}.`);
    return 0;
  }

  console.error(`${audit ? 'QuickLifts-Web voice copy audit findings' : 'New QuickLifts-Web voice copy violations'}: ${activeFindings.length}`);
  for (const finding of activeFindings) {
    console.error(formatFinding(finding));
  }
  if (!audit) {
    console.error('\nRewrite the copy or intentionally refresh the baseline with:');
    console.error('  npm run copy:pulsecheck:update-baseline');
  }
  return 1;
}

process.exitCode = main();
