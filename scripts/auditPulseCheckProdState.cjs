#!/usr/bin/env node
// =============================================================================
// auditPulseCheckProdState — read-only snapshot of who/what is in PulseCheck.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
//     node scripts/auditPulseCheckProdState.cjs
//
//   (default project is prod `quicklifts-dd3f1`; pass --project <id> to override)
//
// Reports counts + a per-team breakdown of memberships by role, with a special
// callout for clinician staff. NEVER writes anything.
// =============================================================================

const admin = require('firebase-admin');
const path = require('node:path');

function parseArgs(argv) {
  const opts = {
    projectId: process.env.FIREBASE_PROJECT_ID || 'quicklifts-dd3f1',
    serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') { opts.projectId = argv[++i]; continue; }
    if (a === '--service-account') { opts.serviceAccountPath = argv[++i]; continue; }
    if (a === '--json') { opts.json = true; continue; }
    if (a === '-h' || a === '--help') {
      console.log('Usage: GOOGLE_APPLICATION_CREDENTIALS=<path> node scripts/auditPulseCheckProdState.cjs [--project <id>] [--json]');
      process.exit(0);
    }
  }
  return opts;
}

function initAdmin(opts) {
  if (admin.apps.length) return admin.app();
  const init = { projectId: opts.projectId };
  if (opts.serviceAccountPath) {
    const serviceAccount = require(path.resolve(opts.serviceAccountPath));
    init.credential = admin.credential.cert(serviceAccount);
  } else {
    init.credential = admin.credential.applicationDefault();
  }
  return admin.initializeApp(init);
}

const PILOTS = 'pulsecheck-pilots';
const ORGS = 'pulsecheck-organizations';
const TEAMS = 'pulsecheck-teams';
const TEAM_MEMBERSHIPS = 'pulsecheck-team-memberships';
const ENROLLMENTS = 'pulsecheck-pilot-enrollments';
const SPORT_CONFIGS = 'pulsecheck-sport-configurations';
const HCSR = 'health-context-source-records';
const SNAPSHOTS = 'health-context-snapshots';
const ESCALATIONS = 'pulsecheck-clinical-escalations';

async function fetchAll(db, collection) {
  const snap = await db.collection(collection).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  initAdmin(opts);
  const db = admin.firestore();

  console.log(`\n=== PulseCheck audit · project=${opts.projectId} ===\n`);

  const [pilots, orgs, teams, memberships, enrollments, sportConfigs] = await Promise.all([
    fetchAll(db, PILOTS),
    fetchAll(db, ORGS),
    fetchAll(db, TEAMS),
    fetchAll(db, TEAM_MEMBERSHIPS),
    fetchAll(db, ENROLLMENTS),
    fetchAll(db, SPORT_CONFIGS).catch(() => []),
  ]);

  // Quick counts on the bigger collections (use server-side aggregate when available)
  const hcsrCount = await db.collection(HCSR).count().get().then((s) => s.data().count).catch(() => 'n/a');
  const snapshotCount = await db.collection(SNAPSHOTS).count().get().then((s) => s.data().count).catch(() => 'n/a');
  const escalationCount = await db.collection(ESCALATIONS).count().get().then((s) => s.data().count).catch(() => 'n/a');

  // Roll up memberships by team + role
  const membershipsByTeam = new Map();
  for (const m of memberships) {
    const tid = m.teamId || '(none)';
    if (!membershipsByTeam.has(tid)) membershipsByTeam.set(tid, []);
    membershipsByTeam.get(tid).push(m);
  }

  const roleCounts = memberships.reduce((acc, m) => {
    const r = m.role || '(unset)';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  const enrollmentsByPilot = new Map();
  for (const e of enrollments) {
    const pid = e.pilotId || '(none)';
    if (!enrollmentsByPilot.has(pid)) enrollmentsByPilot.set(pid, []);
    enrollmentsByPilot.get(pid).push(e);
  }

  const clinicians = memberships.filter((m) => m.role === 'clinician');

  if (opts.json) {
    console.log(JSON.stringify({
      project: opts.projectId,
      counts: {
        pilots: pilots.length,
        organizations: orgs.length,
        teams: teams.length,
        teamMemberships: memberships.length,
        pilotEnrollments: enrollments.length,
        sportConfigs: sportConfigs.length,
        hcsrRecords: hcsrCount,
        snapshots: snapshotCount,
        clinicalEscalations: escalationCount,
      },
      roleCounts,
      pilots: pilots.map((p) => ({ id: p.id, displayName: p.displayName, status: p.status, organizationId: p.organizationId, teamId: p.teamId })),
      teams: teams.map((t) => ({ id: t.id, displayName: t.displayName, status: t.status, organizationId: t.organizationId })),
      clinicians: clinicians.map((m) => ({ teamId: m.teamId, userId: m.userId, email: m.email, hasPhone: Boolean(m.phone || m.notificationPreferences?.smsPhone) })),
    }, null, 2));
    return;
  }

  console.log('## Counts');
  console.log(`  pilots                : ${pilots.length}`);
  console.log(`  organizations         : ${orgs.length}`);
  console.log(`  teams                 : ${teams.length}`);
  console.log(`  team memberships      : ${memberships.length}`);
  console.log(`  pilot enrollments     : ${enrollments.length}`);
  console.log(`  sport configs (SI)    : ${sportConfigs.length}`);
  console.log(`  HCSR records          : ${hcsrCount}`);
  console.log(`  health snapshots      : ${snapshotCount}`);
  console.log(`  clinical escalations  : ${escalationCount}`);

  console.log('\n## Memberships by role');
  for (const [role, count] of Object.entries(roleCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${role.padEnd(22)}: ${count}`);
  }

  console.log('\n## Pilots');
  if (pilots.length === 0) {
    console.log('  (none)');
  } else {
    for (const p of pilots) {
      const enr = enrollmentsByPilot.get(p.id) || [];
      console.log(`  · ${p.id}`);
      console.log(`      displayName : ${p.displayName || '—'}`);
      console.log(`      status      : ${p.status || '—'}`);
      console.log(`      teamId      : ${p.teamId || '—'}`);
      console.log(`      enrollments : ${enr.length}`);
    }
  }

  console.log('\n## Teams (with role breakdown)');
  if (teams.length === 0) {
    console.log('  (none)');
  } else {
    for (const t of teams) {
      const mems = membershipsByTeam.get(t.id) || [];
      const byRole = mems.reduce((acc, m) => {
        const r = m.role || '(unset)';
        acc[r] = (acc[r] || 0) + 1;
        return acc;
      }, {});
      console.log(`  · ${t.id}`);
      console.log(`      displayName : ${t.displayName || '—'}`);
      console.log(`      status      : ${t.status || '—'}`);
      console.log(`      orgId       : ${t.organizationId || '—'}`);
      console.log(`      memberships : ${mems.length} (${Object.entries(byRole).map(([r, c]) => `${r}:${c}`).join(', ') || 'none'})`);
    }
  }

  console.log('\n## Clinicians on staff');
  if (clinicians.length === 0) {
    console.log('  (none) — Tier 3 routing will return 409 for every team.');
  } else {
    for (const c of clinicians) {
      const phoneOnFile = Boolean(c.phone || c.notificationPreferences?.smsPhone);
      console.log(`  · team=${c.teamId || '—'} user=${c.userId || '—'}`);
      console.log(`      email: ${c.email || '(missing!)'}`);
      console.log(`      phone on file: ${phoneOnFile ? 'yes' : 'NO — SMS leg of Tier 3 will not fire'}`);
    }
  }

  console.log('\n## Tier 3 routing readiness summary');
  const teamsWithClinician = new Set(clinicians.map((c) => c.teamId).filter(Boolean));
  const teamIdsAll = new Set(teams.map((t) => t.id));
  const teamsWithoutClinician = [...teamIdsAll].filter((id) => !teamsWithClinician.has(id));
  console.log(`  teams with at least one clinician: ${teamsWithClinician.size}/${teamIdsAll.size}`);
  if (teamsWithoutClinician.length > 0) {
    console.log(`  teams that would 409 on Tier 3:`);
    for (const id of teamsWithoutClinician) console.log(`    · ${id}`);
  }

  console.log('\nDone. (read-only — no writes performed)\n');
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
