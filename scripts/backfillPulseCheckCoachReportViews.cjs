#!/usr/bin/env node
'use strict';

/**
 * Creates coach-safe Sports Intelligence projections from reviewed reports.
 *
 * Dry-run by default:
 *   node scripts/backfillPulseCheckCoachReportViews.cjs --project=dev
 *
 * Apply after reviewing counts:
 *   node scripts/backfillPulseCheckCoachReportViews.cjs --project=dev --apply
 *   node scripts/backfillPulseCheckCoachReportViews.cjs --project=prod --team-id=<teamId> --apply
 */

const { initializeApp, getApps } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const {
  DEFAULT_PROJECT_ID,
  resolveAdminCredential,
} = require('./lib/resolveAdminCredential');

const DEV_PROJECT_ID = 'quicklifts-dev-01';
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const VISIBLE_STATUSES = new Set(['published', 'sent']);

const normalizeString = (value) =>
  typeof value === 'string' ? value.trim() : '';

const stripUndefined = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripUndefined).filter((entry) => entry !== undefined);
  }
  if (!value || typeof value !== 'object') return value;
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) result[key] = stripUndefined(entry);
  }
  return result;
};

const buildCoachReportProjection = (
  report,
  teamId,
  organizationId,
  reportId,
  serverTimestamp
) => {
  const surface = report?.coachSurface || {};
  const meta = surface.meta || {};
  const safeMeta = {
    reportId,
    teamId,
    organizationId,
    teamName: normalizeString(meta.teamName || report.teamName),
    sportId: normalizeString(meta.sportId || report.sportId),
    sportName: normalizeString(meta.sportName || report.sportName),
    reportType: normalizeString(meta.reportType || report.reportType) || 'weekly',
    weekStart: normalizeString(meta.weekStart || report.weekStart),
    weekLabel: normalizeString(meta.weekLabel || report.weekLabel),
    generatedAt: meta.generatedAt || report.generatedAt,
    reviewedBy: normalizeString(meta.reviewedBy),
    reviewerName: normalizeString(meta.reviewerName),
    reviewStatus: normalizeString(report.reviewStatus),
    source: normalizeString(meta.source || report.source),
    primarySportColor: normalizeString(meta.primarySportColor),
    primarySportColorSoft: normalizeString(meta.primarySportColorSoft),
  };

  return stripUndefined({
    teamId,
    organizationId,
    sportId: normalizeString(report.sportId || meta.sportId),
    weekStart: normalizeString(report.weekStart || meta.weekStart),
    reportType: normalizeString(report.reportType || meta.reportType) || 'weekly',
    source: normalizeString(report.source),
    reviewStatus: normalizeString(report.reviewStatus),
    deliveryStatus: normalizeString(report.deliveryStatus),
    coachSurface: {
      meta: safeMeta,
      topLine: surface.topLine || {},
      dimensionState: surface.dimensionState || {},
      watchlist: Array.isArray(surface.watchlist) ? surface.watchlist : [],
      coachActions: Array.isArray(surface.coachActions) ? surface.coachActions : [],
      gameDayLookFors: Array.isArray(surface.gameDayLookFors)
        ? surface.gameDayLookFors
        : [],
      adherence: surface.adherence || {},
      closer: normalizeString(surface.closer),
    },
    createdAt: report.createdAt || serverTimestamp,
    publishedAt: report.publishedAt || serverTimestamp,
    sentAt: report.sentAt,
    updatedAt: serverTimestamp,
  });
};

const parseArgs = (argv) => {
  const projectArg = argv
    .find((value) => value.startsWith('--project='))
    ?.slice('--project='.length);
  const teamId = argv
    .find((value) => value.startsWith('--team-id='))
    ?.slice('--team-id='.length)
    .trim() || '';
  const normalizedProject = normalizeString(projectArg).toLowerCase();
  return {
    apply: argv.includes('--apply'),
    projectId:
      normalizedProject === 'dev'
        ? DEV_PROJECT_ID
        : normalizedProject === 'prod' || !normalizedProject
          ? DEFAULT_PROJECT_ID
          : normalizeString(projectArg),
    teamId,
  };
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.teamId && !SAFE_ID.test(args.teamId)) {
    throw new Error('The team filter must be a safe Firestore document id.');
  }

  const appName = `backfill-pulsecheck-coach-report-views-${args.projectId}`;
  const app = getApps().find((candidate) => candidate.name === appName)
    || initializeApp(
      {
        credential: resolveAdminCredential(),
        projectId: args.projectId,
      },
      appName
    );
  const database = getFirestore(app);
  const snapshot = await database.collectionGroup('coachReports').get();
  const candidates = snapshot.docs.filter((document) => {
    const parts = document.ref.path.split('/');
    if (
      parts.length !== 4
      || parts[0] !== 'teams'
      || parts[2] !== 'coachReports'
      || !SAFE_ID.test(parts[1])
      || !SAFE_ID.test(parts[3])
    ) {
      return false;
    }
    const report = document.data() || {};
    return (
      (!args.teamId || parts[1] === args.teamId)
      && VISIBLE_STATUSES.has(normalizeString(report.reviewStatus).toLowerCase())
      && normalizeString(report.teamId || report.coachSurface?.meta?.teamId) === parts[1]
      && report.coachSurface
      && typeof report.coachSurface === 'object'
    );
  });

  console.log('Backfill PulseCheck coach report views');
  console.log(`Project: ${args.projectId}`);
  console.log(`Mode: ${args.apply ? 'apply' : 'dry-run'}`);
  console.log(`Reviewed source reports: ${candidates.length}`);

  let batch = database.batch();
  let pending = 0;
  let written = 0;
  let skipped = 0;

  for (const document of candidates) {
    const parts = document.ref.path.split('/');
    const teamId = parts[1];
    const reportId = parts[3];
    const report = document.data() || {};
    const teamSnapshot = await database
      .collection('pulsecheck-teams')
      .doc(teamId)
      .get();
    const team = teamSnapshot.exists ? teamSnapshot.data() || {} : {};
    const organizationId = normalizeString(
      report.organizationId
      || report.coachSurface?.meta?.organizationId
      || team.organizationId
    );
    if (
      !teamSnapshot.exists
      || !SAFE_ID.test(organizationId)
      || normalizeString(team.organizationId) !== organizationId
    ) {
      skipped += 1;
      console.log(`Skip ${teamId}/${reportId}: team or organization scope is incomplete`);
      continue;
    }

    const organizationSnapshot = await database
      .collection('pulsecheck-organizations')
      .doc(organizationId)
      .get();
    if (!organizationSnapshot.exists) {
      skipped += 1;
      console.log(`Skip ${teamId}/${reportId}: organization is missing`);
      continue;
    }

    console.log(`Project ${teamId}/${reportId}`);
    if (!args.apply) continue;

    const projection = buildCoachReportProjection(
      report,
      teamId,
      organizationId,
      reportId,
      FieldValue.serverTimestamp()
    );
    const target = database
      .collection('teams')
      .doc(teamId)
      .collection('coachReportViews')
      .doc(reportId);
    batch.set(target, projection, { merge: false });
    pending += 1;

    if (pending === 400) {
      await batch.commit();
      written += pending;
      batch = database.batch();
      pending = 0;
    }
  }

  if (args.apply && pending > 0) {
    await batch.commit();
    written += pending;
  }

  console.log(`Skipped: ${skipped}`);
  console.log(args.apply ? `Written: ${written}` : 'Dry run only. Re-run with --apply to write.');
}

module.exports = {
  buildCoachReportProjection,
  parseArgs,
  stripUndefined,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
