#!/usr/bin/env node

const {
  APP_NAMES,
  admin,
  ensureDefaultFirebaseAdminApp,
  getNamedFirebaseAdminApp,
} = require('../src/lib/server/firebase/app-registry');
const {
  parseDeleteSources,
  repairRunRoundDuplicates,
} = require('../netlify/functions/utils/run-round-duplicate-repair');

function parseArgs(argv) {
  const options = {
    mode: 'prod',
    challengeId: '',
    userId: '',
    username: '',
    startDate: null,
    endDate: null,
    allowTreadmill: null,
    writeAudits: false,
    deleteSources: [],
    verbose: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--mode':
        options.mode = argv[index + 1] || options.mode;
        index += 1;
        break;
      case '--challenge-id':
        options.challengeId = argv[index + 1] || '';
        index += 1;
        break;
      case '--user-id':
        options.userId = argv[index + 1] || '';
        index += 1;
        break;
      case '--username':
        options.username = argv[index + 1] || '';
        index += 1;
        break;
      case '--start-date':
        options.startDate = numberOrNull(argv[index + 1]);
        index += 1;
        break;
      case '--end-date':
        options.endDate = numberOrNull(argv[index + 1]);
        index += 1;
        break;
      case '--allow-treadmill':
        options.allowTreadmill = parseBoolean(argv[index + 1], true);
        index += 1;
        break;
      case '--write-audits':
        options.writeAudits = true;
        break;
      case '--delete-source':
        options.deleteSources.push(argv[index + 1] || '');
        index += 1;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        break;
    }
  }

  return options;
}

function parseBoolean(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  return fallback;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/repair-run-round-duplicates.cjs --challenge-id <id> [options]

Options:
  --mode <prod|dev>              Firebase app mode. Default: prod
  --challenge-id <id>            Required run round / challenge id
  --user-id <id>                 Optional single-user scope
  --username <name>              Optional username filter (client-side)
  --start-date <unix-seconds>    Override round start date
  --end-date <unix-seconds>      Override round end date
  --allow-treadmill <bool>       Override treadmill inclusion. Default: round config
  --write-audits                 Persist runValidationAudits for non-preferred duplicates
  --delete-source <collection>   Delete duplicates from one or more raw sources:
                                 runSummaries | appleWatchWorkoutSummaries | fatBurnSummaries | all
                                 Repeat the flag or use a comma-separated list to target multiple sources.
  --verbose                      Print per-group details
  --json                         Emit machine-readable JSON summary

Notes:
  - Dry-run by default: no writes happen unless --write-audits and/or --delete-source is provided.
  - Deleting raw docs changes what currently shipped clients will render, so review dry-run output first.
`);
}

function getAdminApp(mode) {
  if (mode === 'dev') {
    return getNamedFirebaseAdminApp({
      mode: 'dev',
      appName: APP_NAMES.dev,
      runtime: 'script',
      allowApplicationDefault: true,
      failClosed: false,
    });
  }

  return ensureDefaultFirebaseAdminApp({
    mode: 'prod',
    runtime: 'script',
    allowApplicationDefault: true,
    failClosed: false,
  });
}

function printReport(report, verbose) {
  console.log('Run round duplicate repair report');
  console.log(`Challenge: ${report.challengeId}${report.roundTitle ? ` (${report.roundTitle})` : ''}`);
  console.log(`Mode: ${report.mode}`);
  console.log(`Round doc: ${report.roundFound ? report.roundCollection : 'not found'}`);
  console.log(`Window: ${report.startDate || 'none'} -> ${report.endDate || 'none'}`);
  console.log(`Participants processed: ${report.participantsProcessed.length}`);
  console.log(`Raw runs: ${report.totalRawRuns}`);
  console.log(`Deduped runs: ${report.totalDedupedRuns}`);
  console.log(`Duplicate groups: ${report.totalDuplicateGroups}`);
  console.log(`Suppressed runs: ${report.totalSuppressedRuns}`);
  console.log(`Audits written: ${report.auditsWritten}`);
  console.log(`Deletes applied: ${report.deletesApplied}`);

  report.participantsProcessed.forEach((participant) => {
    console.log('');
    console.log(`User ${participant.username || participant.userId}`);
    console.log(`  raw=${participant.rawRuns} deduped=${participant.dedupedRuns} duplicateGroups=${participant.duplicateGroups} suppressed=${participant.suppressedRuns}`);

    if (verbose) {
      participant.groups.forEach((group) => {
        console.log(`  Group ${group.groupIndex}`);
        console.log(`    keep: ${group.preferred.sourceCollection}/${group.preferred.sourceDocId} ${group.preferred.title} ${group.preferred.distance}mi`);
        group.suppressed.forEach((entry) => {
          console.log(`    suppress: ${entry.sourceCollection}/${entry.sourceDocId} ${entry.title} ${entry.distance}mi`);
        });
      });
    }
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.challengeId) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  const app = getAdminApp(options.mode);
  const db = admin.firestore(app);
  const report = await repairRunRoundDuplicates(db, {
    ...options,
    deleteSources: parseDeleteSources(options.deleteSources),
  });

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printReport(report, options.verbose);
}

main().catch((error) => {
  console.error(`[repair-run-round-duplicates] ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
