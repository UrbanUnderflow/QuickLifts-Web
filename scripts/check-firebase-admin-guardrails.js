const fs = require('fs');
const path = require('path');

const SCAN_ROOTS = [
  'src/pages/api',
  'netlify/functions',
];

const FILE_EXTENSIONS = new Set(['.js', '.ts', '.tsx', '.mjs']);

const ALLOWLIST = new Set([]);

const PATTERNS = [
  {
    label: 'initializeApp',
    regex: /\binitializeApp\s*\(/g,
  },
  {
    label: 'credential.cert',
    regex: /\bcredential\.cert\s*\(/g,
  },
  {
    label: 'raw Firebase credential env',
    regex:
      /process\.env\.(?:DEV_)?FIREBASE_(?:SERVICE_ACCOUNT(?:_KEY)?|PROJECT_ID|CLIENT_EMAIL|PRIVATE_KEY(?:_ALT|_[1-4])?|SECRET_KEY(?:_ALT)?)/g,
  },
];

function walkDirectory(dirPath, results = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === '__tests__') {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(fullPath, results);
      continue;
    }

    if (!FILE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    results.push(fullPath);
  }

  return results;
}

function collectMatches(content) {
  const matches = [];
  for (const pattern of PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    if (pattern.label === 'initializeApp') {
      const hasFirebaseAdminReference =
        content.includes('firebase-admin') ||
        content.includes("require('./config/firebase')") ||
        content.includes('require("./config/firebase")') ||
        content.includes("from './config/firebase'") ||
        content.includes('from "./config/firebase"');
      if (!hasFirebaseAdminReference) {
        continue;
      }
    }

    if (regex.test(content)) {
      matches.push(pattern.label);
    }
  }
  return matches;
}

function toRelative(filePath) {
  return path.relative(process.cwd(), filePath).split(path.sep).join('/');
}

function main() {
  const blocking = [];
  const allowlistedHits = [];

  for (const scanRoot of SCAN_ROOTS) {
    const absoluteRoot = path.join(process.cwd(), scanRoot);
    if (!fs.existsSync(absoluteRoot)) {
      continue;
    }

    for (const filePath of walkDirectory(absoluteRoot)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const matches = collectMatches(content);
      if (matches.length === 0) {
        continue;
      }

      const relativePath = toRelative(filePath);
      const record = `${relativePath} -> ${matches.join(', ')}`;
      if (ALLOWLIST.has(relativePath)) {
        allowlistedHits.push(record);
      } else {
        blocking.push(record);
      }
    }
  }

  if (blocking.length > 0) {
    console.error('[firebase-admin-guardrails] Found unapproved Firebase credential/init usage:');
    for (const item of blocking) {
      console.error(`- ${item}`);
    }
    console.error('');
    console.error('[firebase-admin-guardrails] Move these callsites onto the shared adapter or add a documented temporary allowlist entry.');
    process.exit(1);
  }

  console.log('[firebase-admin-guardrails] No unapproved Firebase credential/init usage found.');
  if (allowlistedHits.length > 0) {
    console.log('[firebase-admin-guardrails] Temporary allowlisted exceptions:');
    for (const item of allowlistedHits) {
      console.log(`- ${item}`);
    }
  }
}

main();
