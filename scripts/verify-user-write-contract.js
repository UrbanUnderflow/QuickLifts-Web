#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

function runRg(args) {
  try {
    return execFileSync('rg', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (error.status === 1) {
      return '';
    }

    throw error;
  }
}

const suspiciousUpdatePatterns = [
  'userService\\.updateUser\\(.*new User',
  'userService\\.updateUser\\(.*\\.toDictionary\\(',
  'userService\\.updateUser\\([^,]+,\\s*firestoreUser\\b',
  'userService\\.updateUser\\([^,]+,\\s*currentUserData\\b',
  'userService\\.updateUser\\([^,]+,\\s*updatedUser\\b',
  'userService\\.updateUser\\([^,]+,\\s*newUser\\b',
];

const suspiciousUpdateHits = suspiciousUpdatePatterns.flatMap((pattern) =>
  runRg(['-n', '--pcre2', pattern, 'src'])
    .split('\n')
    .filter(Boolean)
);

const directRootWrites = runRg([
  '-n',
  "setDoc\\(doc\\(db, ['\"]users['\"]|updateDoc\\(doc\\(db, ['\"]users['\"]",
  'src',
  '--glob',
  '!src/api/firebase/user/service.ts',
]);

if (suspiciousUpdateHits.length > 0 || directRootWrites.length > 0) {
  console.error('User write contract verification failed.');

  if (suspiciousUpdateHits.length > 0) {
    console.error('\nSuspicious updateUser call sites:');
    suspiciousUpdateHits.forEach((hit) => console.error(`  ${hit}`));
  }

  if (directRootWrites.length > 0) {
    console.error('\nDirect root users/ writes outside the user service:');
    directRootWrites.split('\n').forEach((hit) => console.error(`  ${hit}`));
  }

  process.exit(1);
}

console.log('User write contract verification passed.');
