#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('node:path');
const util = require('node:util');

function parseArgs(argv) {
  const options = {
    userId: process.env.PULSECHECK_PROBE_USER_ID || '',
    sourceDate: process.env.PULSECHECK_PROBE_SOURCE_DATE || '',
    projectId: process.env.FIREBASE_PROJECT_ID || 'quicklifts-db4f1',
    serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--user') {
      options.userId = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--date') {
      options.sourceDate = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--project') {
      options.projectId = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--service-account') {
      options.serviceAccountPath = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--json') {
      options.json = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.userId || !options.sourceDate) {
    throw new Error('Missing required --user and/or --date arguments.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.sourceDate)) {
    throw new Error(`Invalid --date value: ${options.sourceDate}`);
  }

  return options;
}

function printHelp() {
  console.log(
    [
      'Usage:',
      '  node scripts/probe-pulsecheck-repair-live.cjs --user <uid> --date <YYYY-MM-DD> [--project <projectId>] [--service-account <path>] [--json]',
      '',
      'Examples:',
      '  node scripts/probe-pulsecheck-repair-live.cjs --user Bq6zlqIlSdPUGki6gsv6X9TdVtG3 --date 2026-03-21',
      '  node scripts/probe-pulsecheck-repair-live.cjs --user Bq6zlqIlSdPUGki6gsv6X9TdVtG3 --date 2026-03-21 --service-account ~/secrets/pulsecheck-prod.json',
      '  PULSECHECK_PROBE_USER_ID=Bq6... PULSECHECK_PROBE_SOURCE_DATE=2026-03-21 node scripts/probe-pulsecheck-repair-live.cjs --json',
    ].join('\n')
  );
}

function formatPrivateKey(key) {
  if (!key) return '';

  let formatted = String(key).trim();
  if (formatted.startsWith('"') && formatted.endsWith('"')) {
    formatted = formatted.slice(1, -1);
  }
  if (formatted.startsWith("'") && formatted.endsWith("'")) {
    formatted = formatted.slice(1, -1);
  }
  if (formatted.includes('\\n')) {
    formatted = formatted.replace(/\\n/g, '\n');
  }
  if (
    formatted
    && !formatted.includes('-----BEGIN PRIVATE KEY-----')
    && !formatted.includes('-----END PRIVATE KEY-----')
  ) {
    formatted = `-----BEGIN PRIVATE KEY-----\n${formatted}\n-----END PRIVATE KEY-----`;
  }

  return formatted;
}

function initializeAdmin(projectId, serviceAccountPath) {
  if (admin.apps.length) {
    return admin.app();
  }

  if (serviceAccountPath) {
    const resolvedPath = path.resolve(serviceAccountPath);
    // Reuse Google ADC conventions so firebase-admin can load this file transparently.
    process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
  }

  const privateKey = formatPrivateKey(process.env.FIREBASE_SECRET_KEY || process.env.GOOGLE_PRIVATE_KEY || '');
  const privateKeyId = process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY_ID || undefined;
  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL
    || process.env.GOOGLE_CLIENT_EMAIL
    || '';

  if (privateKey && clientEmail) {
    return admin.initializeApp({
      credential: admin.credential.cert({
        type: 'service_account',
        project_id: projectId,
        private_key_id: privateKeyId,
        private_key: privateKey,
        client_email: clientEmail,
      }),
      projectId,
    });
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
}

function compactObject(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => compactObject(entry))
      .filter((entry) => entry !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((accumulator, [key, entry]) => {
      const compacted = compactObject(entry);
      if (compacted !== undefined) {
        accumulator[key] = compacted;
      }
      return accumulator;
    }, {});
  }

  return value === undefined ? undefined : value;
}

function summarizeSimRecord(record, runtimeHelpers) {
  if (!record) return null;

  const buildArtifact = record.buildArtifact && typeof record.buildArtifact === 'object'
    ? record.buildArtifact
    : null;
  const variantSource = record.variantSource && typeof record.variantSource === 'object'
    ? record.variantSource
    : null;

  return compactObject({
    id: record.id || null,
    simSpecId: record.simSpecId || null,
    name: record.name || null,
    isActive: record.isActive !== false,
    publishStatus: record.publishStatus || null,
    syncStatus: record.syncStatus || null,
    publishedFingerprint: record.publishedFingerprint || null,
    governanceStage: record.governanceStage || null,
    engineKey: record.engineKey || buildArtifact?.engineKey || null,
    hasRuntimeConfig: Boolean(record.runtimeConfig && typeof record.runtimeConfig === 'object'),
    variantPublishedAt: variantSource?.publishedAt || null,
    sourceFingerprint: buildArtifact?.sourceFingerprint || null,
    passesPublishedFilter: runtimeHelpers.isPublishedSimModuleRecord(record),
  });
}

async function fetchRawSimMatches(db, identifiers) {
  const matches = new Map();
  const simModules = db.collection('sim-modules');

  const docIds = Array.from(
    new Set(
      identifiers
        .map((entry) => entry.legacyExerciseId)
        .filter((value) => typeof value === 'string' && value.trim())
    )
  );

  await Promise.all(
    docIds.map(async (docId) => {
      const snap = await simModules.doc(docId).get();
      if (snap.exists) {
        matches.set(`doc:${docId}`, { id: snap.id, ...snap.data() });
      }
    })
  );

  const simSpecIds = Array.from(
    new Set(
      identifiers
        .map((entry) => entry.recommendedSimId)
        .filter((value) => typeof value === 'string' && value.trim())
    )
  );

  await Promise.all(
    simSpecIds.map(async (simSpecId) => {
      const snap = await simModules.where('simSpecId', '==', simSpecId).get();
      snap.docs.forEach((docSnap) => {
        matches.set(`spec:${docSnap.id}`, { id: docSnap.id, ...docSnap.data() });
      });
    })
  );

  return Array.from(matches.values());
}

function findPublishedRegistryMatches(liveSimRegistry, identifiers) {
  const wantedDocIds = new Set(
    identifiers
      .map((entry) => entry.legacyExerciseId)
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim().toLowerCase())
  );
  const wantedSimSpecIds = new Set(
    identifiers
      .map((entry) => entry.recommendedSimId)
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim().toLowerCase())
  );

  return liveSimRegistry.filter((record) => {
    const id = typeof record.id === 'string' ? record.id.trim().toLowerCase() : '';
    const simSpecId = typeof record.simSpecId === 'string' ? record.simSpecId.trim().toLowerCase() : '';
    return wantedDocIds.has(id) || wantedSimSpecIds.has(simSpecId) || wantedSimSpecIds.has(id);
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  initializeAdmin(options.projectId, options.serviceAccountPath);

  const repoRoot = path.resolve(__dirname, '..');
  const submitPath = path.join(repoRoot, 'netlify/functions/submit-pulsecheck-checkin.js');
  const { runtimeHelpers } = require(submitPath);

  const db = admin.firestore();
  const assignmentId = `${options.userId}_${options.sourceDate}`;

  const [snapshotSnap, progressSnap, assignmentSnap, signalEventsSnap] = await Promise.all([
    db.collection('state-snapshots').doc(assignmentId).get(),
    db.collection('athlete-mental-progress').doc(options.userId).get(),
    db.collection('pulsecheck-daily-assignments').doc(assignmentId).get(),
    db.collection('conversation-derived-signal-events')
      .where('athleteId', '==', options.userId)
      .where('sourceDate', '==', options.sourceDate)
      .get(),
  ]);

  const snapshot = snapshotSnap.exists ? { id: snapshotSnap.id, ...snapshotSnap.data() } : null;
  const progress = progressSnap.exists ? progressSnap.data() || {} : null;
  const assignment = assignmentSnap.exists ? { id: assignmentSnap.id, ...assignmentSnap.data() } : null;

  const resolvedActiveProgram = runtimeHelpers.resolveActiveProgramContext({ snapshot, progress });
  const liveSimRegistry = await runtimeHelpers.listLivePublishedSimModules(db);
  const publishedSimResolution = runtimeHelpers.resolvePublishedSimCandidate(resolvedActiveProgram, liveSimRegistry);
  const candidateSet = snapshot
    ? runtimeHelpers.buildAssignmentCandidateSet({
        athleteId: options.userId,
        sourceDate: options.sourceDate,
        snapshot,
        progress,
        liveProtocolRegistry: [],
        liveSimRegistry,
        responsivenessProfile: null,
      })
    : null;

  const rawSimMatches = await fetchRawSimMatches(db, [
    compactObject({
      recommendedSimId: progress?.activeProgram?.recommendedSimId || null,
      legacyExerciseId: progress?.activeProgram?.recommendedLegacyExerciseId || null,
    }),
    compactObject({
      recommendedSimId: snapshot?.rawSignalSummary?.activeProgramContext?.recommendedSimId || null,
      legacyExerciseId: snapshot?.rawSignalSummary?.activeProgramContext?.recommendedLegacyExerciseId || null,
    }),
    compactObject({
      recommendedSimId: resolvedActiveProgram?.recommendedSimId || null,
      legacyExerciseId: resolvedActiveProgram?.recommendedLegacyExerciseId || null,
    }),
  ]);

  const publishedRegistryMatches = findPublishedRegistryMatches(liveSimRegistry, [
    compactObject({
      recommendedSimId: progress?.activeProgram?.recommendedSimId || null,
      legacyExerciseId: progress?.activeProgram?.recommendedLegacyExerciseId || null,
    }),
    compactObject({
      recommendedSimId: snapshot?.rawSignalSummary?.activeProgramContext?.recommendedSimId || null,
      legacyExerciseId: snapshot?.rawSignalSummary?.activeProgramContext?.recommendedLegacyExerciseId || null,
    }),
    compactObject({
      recommendedSimId: resolvedActiveProgram?.recommendedSimId || null,
      legacyExerciseId: resolvedActiveProgram?.recommendedLegacyExerciseId || null,
    }),
  ]);

  const result = compactObject({
    projectId: options.projectId,
    userId: options.userId,
    sourceDate: options.sourceDate,
    assignmentId,
    snapshotExists: Boolean(snapshot),
    progressExists: Boolean(progress),
    assignmentExists: Boolean(assignment),
    signalEventCount: signalEventsSnap.size,
    latestSignalEvent: signalEventsSnap.empty
      ? null
      : compactObject({
          id: signalEventsSnap.docs[0].id,
          decisionSource: signalEventsSnap.docs[0].data()?.decisionSource || null,
          createdAt: signalEventsSnap.docs[0].data()?.createdAt || null,
          inferredRouting: signalEventsSnap.docs[0].data()?.inferredDelta?.recommendedRouting || null,
          inferredReadiness: signalEventsSnap.docs[0].data()?.inferredDelta?.overallReadiness || null,
        }),
    assignment: assignment
      ? compactObject({
          id: assignment.id,
          status: assignment.status || null,
          actionType: assignment.actionType || null,
          chosenCandidateId: assignment.chosenCandidateId || null,
          simSpecId: assignment.simSpecId || null,
          legacyExerciseId: assignment.legacyExerciseId || null,
          sourceCheckInId: assignment.sourceCheckInId || null,
        })
      : null,
    snapshot: snapshot
      ? compactObject({
          id: snapshot.id,
          recommendedRouting: snapshot.recommendedRouting || null,
          overallReadiness: snapshot.overallReadiness || null,
          confidence: snapshot.confidence || null,
          candidateClassHints: snapshot.candidateClassHints || [],
          activeProgramContext: snapshot.rawSignalSummary?.activeProgramContext || null,
        })
      : null,
    progress: progress
      ? compactObject({
          activeProgram: progress.activeProgram || null,
        })
      : null,
    resolvedActiveProgram: resolvedActiveProgram || null,
    livePublishedSimRegistryCount: liveSimRegistry.length,
    resolvePublishedSimCandidate: compactObject({
      matchedSimModule: publishedSimResolution.simModule
        ? summarizeSimRecord(publishedSimResolution.simModule, runtimeHelpers)
        : null,
      inventoryGap: publishedSimResolution.inventoryGap || null,
    }),
    rawSimMatches: rawSimMatches.map((record) => summarizeSimRecord(record, runtimeHelpers)),
    publishedRegistryMatches: publishedRegistryMatches.map((record) => summarizeSimRecord(record, runtimeHelpers)),
    candidateSet: candidateSet
      ? compactObject({
          id: candidateSet.id,
          candidateCount: candidateSet.candidates?.length || 0,
          candidateClassHints: candidateSet.candidateClassHints || [],
          constraintReasons: candidateSet.constraintReasons || [],
          inventoryGaps: candidateSet.inventoryGaps || [],
          candidates: (candidateSet.candidates || []).map((candidate) =>
            compactObject({
              id: candidate.id || null,
              type: candidate.type || null,
              actionType: candidate.actionType || null,
              label: candidate.label || null,
              simSpecId: candidate.simSpecId || null,
              legacyExerciseId: candidate.legacyExerciseId || null,
              sessionType: candidate.sessionType || null,
              durationMode: candidate.durationMode || null,
            })
          ),
        })
      : null,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`PulseCheck repair live probe for ${options.userId} on ${options.sourceDate}`);
  console.log(`Project: ${result.projectId}`);
  console.log('');
  console.log('Snapshot');
  console.log(util.inspect(result.snapshot, { depth: null, colors: false, compact: false }));
  console.log('');
  console.log('Progress Active Program');
  console.log(util.inspect(result.progress?.activeProgram || null, { depth: null, colors: false, compact: false }));
  console.log('');
  console.log('Resolved Active Program');
  console.log(util.inspect(result.resolvedActiveProgram, { depth: null, colors: false, compact: false }));
  console.log('');
  console.log('Assignment');
  console.log(util.inspect(result.assignment, { depth: null, colors: false, compact: false }));
  console.log('');
  console.log('Latest Conversation Signal Event');
  console.log(util.inspect(result.latestSignalEvent || null, { depth: null, colors: false, compact: false }));
  console.log('');
  console.log('Published Sim Resolution');
  console.log(util.inspect(result.resolvePublishedSimCandidate, { depth: null, colors: false, compact: false }));
  console.log('');
  console.log('Raw Matching Sim Records');
  console.log(util.inspect(result.rawSimMatches, { depth: null, colors: false, compact: false }));
  console.log('');
  console.log('Published Registry Matches');
  console.log(util.inspect(result.publishedRegistryMatches, { depth: null, colors: false, compact: false }));
  console.log('');
  console.log('Candidate Set');
  console.log(util.inspect(result.candidateSet, { depth: null, colors: false, compact: false }));
}

main().catch((error) => {
  console.error('[probe-pulsecheck-repair-live] Failed:', error?.message || error);
  if (error?.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
