#!/usr/bin/env node
'use strict';

/**
 * Bulk-attach existing PulseCheck athlete accounts to a team + pilot.
 *
 * This is intended for activation-day recovery when athletes already have app
 * accounts, but still need their team membership / pilot enrollment written.
 *
 * Usage examples:
 *   node scripts/bulkAttachPulseCheckPilotAthletes.js \
 *     --project=prod \
 *     --team-id=<teamId> \
 *     --pilot-id=<pilotId> \
 *     --emails="a@school.edu,b@school.edu"
 *
 *   node scripts/bulkAttachPulseCheckPilotAthletes.js \
 *     --project=prod \
 *     --team-id=<teamId> \
 *     --pilot-id=<pilotId> \
 *     --emails-file=/tmp/athletes.txt \
 *     --bypass-wall \
 *     --research-consent=declined \
 *     --apply
 *
 * Notes:
 * - Dry-run by default. Pass --apply to write.
 * - `--bypass-wall` marks athlete onboarding complete on the created membership.
 * - For research pilots, pair `--bypass-wall` with `--research-consent=declined`
 *   if you want app access without placing the athlete into the research dataset.
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const PROD_PROJECT_ID = 'quicklifts-dd3f1';
const DEV_PROJECT_ID = 'quicklifts-dev-01';

const ORGANIZATIONS_COLLECTION = 'pulsecheck-organizations';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const PILOTS_COLLECTION = 'pulsecheck-pilots';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const PILOT_ENROLLMENTS_COLLECTION = 'pulsecheck-pilot-enrollments';
const ATHLETE_PROGRESS_COLLECTION = 'athlete-mental-progress';
const USERS_COLLECTION = 'users';

const DEFAULT_BASELINE_PATHWAY_ID = 'pulsecheck-core-baseline-v1';
const ATHLETE_PERMISSION_SET_ID = 'pulsecheck-athlete-v1';

function parseArgs(argv) {
  const args = {
    apply: argv.includes('--apply'),
    dryRun: !argv.includes('--apply'),
    project: 'prod',
    teamId: '',
    pilotId: '',
    cohortId: '',
    emails: [],
    emailsFile: '',
    bypassWall: argv.includes('--bypass-wall'),
    researchConsent: '',
    grantSource: 'manual-existing-app-attach',
    serviceAccount: '',
  };

  for (const arg of argv) {
    if (arg.startsWith('--project=')) args.project = arg.split('=')[1]?.trim() || args.project;
    if (arg.startsWith('--team-id=')) args.teamId = arg.split('=')[1]?.trim() || '';
    if (arg.startsWith('--pilot-id=')) args.pilotId = arg.split('=')[1]?.trim() || '';
    if (arg.startsWith('--cohort-id=')) args.cohortId = arg.split('=')[1]?.trim() || '';
    if (arg.startsWith('--emails=')) {
      args.emails = arg
        .split('=')[1]
        ?.split(',')
        .map((entry) => normalizeEmail(entry))
        .filter(Boolean) || [];
    }
    if (arg.startsWith('--emails-file=')) args.emailsFile = arg.split('=')[1]?.trim() || '';
    if (arg.startsWith('--research-consent=')) args.researchConsent = arg.split('=')[1]?.trim() || '';
    if (arg.startsWith('--grant-source=')) args.grantSource = arg.split('=')[1]?.trim() || args.grantSource;
    if (arg.startsWith('--service-account=')) args.serviceAccount = arg.split('=')[1]?.trim() || '';
  }

  return args;
}

function resolveProjectId(project) {
  const normalized = String(project || '').trim().toLowerCase();
  if (!normalized || normalized === 'prod' || normalized === 'production') return PROD_PROJECT_ID;
  if (normalized === 'dev' || normalized === 'development') return DEV_PROJECT_ID;
  return project;
}

function resolveCredential(serviceAccountPath) {
  const explicitPath = String(serviceAccountPath || '').trim();
  if (explicitPath) {
    return cert(require(path.resolve(explicitPath)));
  }

  const repoKeyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(repoKeyPath)) {
    return cert(require(repoKeyPath));
  }

  return applicationDefault();
}

function initAdminApp(projectId, serviceAccountPath) {
  const appName = `bulk-attach-pulsecheck-pilot-athletes-${projectId}`;
  const existing = getApps().find((app) => app.name === appName);
  return existing || initializeApp(
    {
      credential: resolveCredential(serviceAccountPath),
      projectId,
    },
    appName
  );
}

function initFirestore(projectId, serviceAccountPath) {
  return getFirestore(initAdminApp(projectId, serviceAccountPath));
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeResearchConsent(value, studyMode) {
  const normalized = normalizeString(value);
  if (normalized === 'accepted' || normalized === 'declined' || normalized === 'pending') {
    return normalized;
  }
  return studyMode === 'research' ? 'pending' : 'not-required';
}

function loadEmails(args) {
  const emailSet = new Set(args.emails);
  if (args.emailsFile) {
    const fileContent = fs.readFileSync(path.resolve(args.emailsFile), 'utf8');
    fileContent
      .split(/\r?\n|,/)
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean)
      .forEach((entry) => emailSet.add(entry));
  }
  return [...emailSet];
}

function deriveTeamPlanBypassesPaywall(commercialConfig) {
  const candidate = commercialConfig && typeof commercialConfig === 'object' ? commercialConfig : {};
  const commercialModel = normalizeString(candidate.commercialModel) === 'team-plan' ? 'team-plan' : 'athlete-pay';
  const teamPlanStatus = normalizeString(candidate.teamPlanStatus) === 'active' ? 'active' : 'inactive';
  return commercialModel === 'team-plan' && teamPlanStatus === 'active';
}

function buildCommercialSnapshot({ organizationId, teamId, commercialConfig, inviteToken }) {
  const candidate = commercialConfig && typeof commercialConfig === 'object' ? commercialConfig : {};
  const commercialModel = normalizeString(candidate.commercialModel) === 'team-plan' ? 'team-plan' : 'athlete-pay';
  const teamPlanStatus = normalizeString(candidate.teamPlanStatus) === 'active' ? 'active' : 'inactive';

  return {
    commercialModel,
    teamPlanStatus,
    referralKickbackEnabled: Boolean(candidate.referralKickbackEnabled),
    referralRevenueSharePct: Number.isFinite(Number(candidate.referralRevenueSharePct))
      ? Math.max(0, Math.min(100, Number(candidate.referralRevenueSharePct)))
      : 0,
    revenueRecipientRole:
      normalizeString(candidate.revenueRecipientRole) === 'coach'
        ? 'coach'
        : normalizeString(candidate.revenueRecipientRole) === 'organization-owner'
          ? 'organization-owner'
          : 'team-admin',
    revenueRecipientUserId: normalizeString(candidate.revenueRecipientUserId),
    billingOwnerUserId: normalizeString(candidate.billingOwnerUserId),
    billingCustomerId: normalizeString(candidate.billingCustomerId),
    teamPlanActivatedAt: candidate.teamPlanActivatedAt || null,
    teamPlanExpiresAt: candidate.teamPlanExpiresAt || null,
    sourceOrganizationId: organizationId,
    sourceTeamId: teamId,
    inviteToken,
    teamPlanBypassesPaywall: deriveTeamPlanBypassesPaywall(candidate),
  };
}

function baselineStateFromProgress(progressDoc) {
  const data = progressDoc && typeof progressDoc === 'object' ? progressDoc : {};
  const assessmentNeeded = data.assessmentNeeded;
  const hasCompletedBaseline =
    assessmentNeeded === false
      || Boolean(data.baselineAssessment)
      || Boolean(data.baselineProbe)
      || Array.isArray(data.currentCanonicalSnapshotIds) && data.currentCanonicalSnapshotIds.length > 0;

  return {
    baselinePathStatus: hasCompletedBaseline ? 'complete' : 'ready',
    baselinePathwayId: normalizeString(data.currentPathway) || DEFAULT_BASELINE_PATHWAY_ID,
  };
}

function resolveMembershipCompletion(input) {
  const researchDecisionResolved =
    input.studyMode !== 'research'
      || input.researchConsentStatus === 'accepted'
      || input.researchConsentStatus === 'declined';
  const requiredConsentsAccepted =
    input.requiredConsentIds.length === 0
      || input.requiredConsentIds.every((consentId) => input.completedConsentIds.includes(consentId));

  const complete =
    input.entryOnboardingStep === 'complete'
    && input.productConsentAccepted
    && requiredConsentsAccepted
    && researchDecisionResolved;

  return {
    onboardingStatus: complete ? 'complete' : 'pending-consent',
    enrollmentStatus: complete ? 'active' : 'pending-consent',
  };
}

async function loadExistingAthleteSeed(db, userId, teamId) {
  const currentMembershipRef = db.collection(TEAM_MEMBERSHIPS_COLLECTION).doc(`${teamId}_${userId}`);
  const currentMembershipSnap = await currentMembershipRef.get();
  if (currentMembershipSnap.exists) {
    return currentMembershipSnap.data() || {};
  }

  const membershipSnap = await db.collection(TEAM_MEMBERSHIPS_COLLECTION).where('userId', '==', userId).get();
  const athleteMembership = membershipSnap.docs
    .map((doc) => doc.data() || {})
    .find((data) => normalizeString(data.role) === 'athlete');

  return athleteMembership || {};
}

async function findUserRecord(db, auth, email) {
  const userSnap = await db.collection(USERS_COLLECTION).where('email', '==', email).limit(1).get();
  if (!userSnap.empty) {
    const userDoc = userSnap.docs[0];
    return {
      source: 'users',
      userId: userDoc.id,
      userData: userDoc.data() || {},
      authUser: null,
    };
  }

  try {
    const authUser = await auth.getUserByEmail(email);
    return {
      source: 'auth',
      userId: authUser.uid,
      userData: {},
      authUser,
    };
  } catch (error) {
    if (error && error.code === 'auth/user-not-found') {
      return null;
    }
    throw error;
  }
}

function buildSeedUserDocument(userId, email, userData, authUser) {
  const currentTime = Date.now() / 1000;
  const candidate = userData && typeof userData === 'object' ? userData : {};
  const existingProfileImage = candidate.profileImage && typeof candidate.profileImage === 'object'
    ? candidate.profileImage
    : {};

  return {
    id: userId,
    email: normalizeString(candidate.email) || email,
    displayName: normalizeString(candidate.displayName) || normalizeString(authUser && authUser.displayName),
    username: normalizeString(candidate.username),
    bio: normalizeString(candidate.bio),
    fcmToken: normalizeString(candidate.fcmToken),
    workoutBuddy: normalizeString(candidate.workoutBuddy),
    level: normalizeString(candidate.level) || 'novice',
    goal: Array.isArray(candidate.goal) ? candidate.goal : [],
    macros: candidate.macros && typeof candidate.macros === 'object' ? candidate.macros : {},
    additionalGoals: normalizeString(candidate.additionalGoals),
    blockedUsers: Array.isArray(candidate.blockedUsers) ? candidate.blockedUsers : [],
    profileImage: {
      profileImageURL: normalizeString(existingProfileImage.profileImageURL),
      imageOffsetWidth: Number.isFinite(Number(existingProfileImage.imageOffsetWidth))
        ? Number(existingProfileImage.imageOffsetWidth)
        : 0,
      imageOffsetHeight: Number.isFinite(Number(existingProfileImage.imageOffsetHeight))
        ? Number(existingProfileImage.imageOffsetHeight)
        : 0,
    },
    registrationComplete:
      typeof candidate.registrationComplete === 'boolean'
        ? candidate.registrationComplete
        : false,
    subscriptionType: normalizeString(candidate.subscriptionType) || 'Unsubscribed',
    subscriptionPlatform: normalizeString(candidate.subscriptionPlatform) || 'ios',
    videoCount: Number.isFinite(Number(candidate.videoCount)) ? Number(candidate.videoCount) : 0,
    isCurrentlyActive: Boolean(candidate.isCurrentlyActive),
    didCompleteProfileQuiz: Boolean(candidate.didCompleteProfileQuiz),
    pulseCheckOnboardingComplete: Boolean(candidate.pulseCheckOnboardingComplete),
    conversationCount: Number.isFinite(Number(candidate.conversationCount)) ? Number(candidate.conversationCount) : 0,
    totalSessionTime: Number.isFinite(Number(candidate.totalSessionTime)) ? Number(candidate.totalSessionTime) : 0,
    createdAt: candidate.createdAt || currentTime,
    updatedAt: currentTime,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectId = resolveProjectId(args.project);
  const adminApp = initAdminApp(projectId, args.serviceAccount);
  const db = getFirestore(adminApp);
  const auth = getAuth(adminApp);
  const emails = loadEmails(args);

  if (!args.teamId || !args.pilotId) {
    throw new Error('--team-id and --pilot-id are required.');
  }
  if (emails.length === 0) {
    throw new Error('Provide athlete emails with --emails or --emails-file.');
  }

  console.log('Bulk Attach PulseCheck Pilot Athletes');
  console.log(`Project: ${projectId}`);
  console.log(`Mode: ${args.dryRun ? 'dry-run' : 'apply'}`);
  console.log(`Team: ${args.teamId}`);
  console.log(`Pilot: ${args.pilotId}`);
  if (args.cohortId) console.log(`Cohort override: ${args.cohortId}`);
  console.log(`Emails: ${emails.length}`);
  console.log(`Bypass wall: ${args.bypassWall ? 'yes' : 'no'}`);

  const [teamSnap, pilotSnap] = await Promise.all([
    db.collection(TEAMS_COLLECTION).doc(args.teamId).get(),
    db.collection(PILOTS_COLLECTION).doc(args.pilotId).get(),
  ]);

  if (!teamSnap.exists) throw new Error('Team not found.');
  if (!pilotSnap.exists) throw new Error('Pilot not found.');

  const teamData = teamSnap.data() || {};
  const pilotData = pilotSnap.data() || {};
  const organizationId = normalizeString(teamData.organizationId || pilotData.organizationId);
  if (!organizationId) throw new Error('Team / pilot missing organizationId.');

  const studyMode = normalizeString(pilotData.studyMode) === 'research' ? 'research' : 'operational';
  const pilotName = normalizeString(pilotData.displayName || pilotData.name);
  const cohortId = normalizeString(args.cohortId || '');
  const requiredConsentDocs = Array.isArray(pilotData.requiredConsents) ? pilotData.requiredConsents : [];
  const requiredConsentIds = requiredConsentDocs
    .map((entry) => normalizeString(entry && typeof entry === 'object' ? entry.id : ''))
    .filter(Boolean);
  const researchConsentStatus = normalizeResearchConsent(args.researchConsent, studyMode);
  const commercialSnapshot = buildCommercialSnapshot({
    organizationId,
    teamId: args.teamId,
    commercialConfig: teamData.commercialConfig || {},
    inviteToken: normalizeString(args.grantSource),
  });

  const results = [];

  for (const email of emails) {
    const userRecord = await findUserRecord(db, auth, email);
    if (!userRecord) {
      results.push({ email, status: 'missing-user' });
      continue;
    }

    const userId = userRecord.userId;
    const userData = userRecord.userData || {};
    const seedUserPatch = buildSeedUserDocument(userId, email, userData, userRecord.authUser);
    const existingSeed = await loadExistingAthleteSeed(db, userId, args.teamId);
    const progressSnap = await db.collection(ATHLETE_PROGRESS_COLLECTION).doc(userId).get();
    const progressData = progressSnap.exists ? progressSnap.data() || {} : {};
    const baselineState = baselineStateFromProgress(progressData);

    const entryOnboardingName =
      normalizeString(existingSeed.athleteOnboarding?.entryOnboardingName)
      || normalizeString(userData.displayName)
      || normalizeString(userData.username);

    const nextAthleteOnboarding = {
      productConsentAccepted:
        args.bypassWall
          ? true
          : Boolean(existingSeed.athleteOnboarding?.productConsentAccepted),
      productConsentAcceptedAt:
        existingSeed.athleteOnboarding?.productConsentAcceptedAt || (args.bypassWall ? FieldValue.serverTimestamp() : null),
      productConsentVersion:
        normalizeString(existingSeed.athleteOnboarding?.productConsentVersion) || (args.bypassWall ? 'manual-existing-app-bypass' : ''),
      entryOnboardingStep:
        args.bypassWall
          ? 'complete'
          : normalizeString(existingSeed.athleteOnboarding?.entryOnboardingStep) || 'name',
      entryOnboardingName,
      researchConsentStatus:
        args.bypassWall
          ? researchConsentStatus
          : normalizeResearchConsent(existingSeed.athleteOnboarding?.researchConsentStatus, studyMode),
      researchConsentVersion:
        normalizeString(existingSeed.athleteOnboarding?.researchConsentVersion)
        || (args.bypassWall && (researchConsentStatus === 'accepted' || researchConsentStatus === 'declined')
          ? 'manual-existing-app-bypass'
          : ''),
      researchConsentRespondedAt:
        existingSeed.athleteOnboarding?.researchConsentRespondedAt
        || (args.bypassWall && (researchConsentStatus === 'accepted' || researchConsentStatus === 'declined')
          ? FieldValue.serverTimestamp()
          : null),
      eligibleForResearchDataset:
        args.bypassWall
          ? researchConsentStatus === 'accepted'
          : Boolean(existingSeed.athleteOnboarding?.eligibleForResearchDataset),
      enrollmentMode:
        studyMode === 'research' && researchConsentStatus === 'accepted'
          ? 'research'
          : 'pilot',
      targetPilotId: args.pilotId,
      targetPilotName: pilotName,
      targetCohortId: cohortId,
      targetCohortName: '',
      requiredConsents: requiredConsentDocs,
      completedConsentIds:
        args.bypassWall
          ? [...requiredConsentIds]
          : Array.isArray(existingSeed.athleteOnboarding?.completedConsentIds)
            ? existingSeed.athleteOnboarding.completedConsentIds
            : [],
      baselinePathStatus:
        normalizeString(existingSeed.athleteOnboarding?.baselinePathStatus) || baselineState.baselinePathStatus,
      baselinePathwayId:
        normalizeString(existingSeed.athleteOnboarding?.baselinePathwayId) || baselineState.baselinePathwayId,
      timezone: normalizeString(existingSeed.athleteOnboarding?.timezone),
    };

    const completion = resolveMembershipCompletion({
      entryOnboardingStep: nextAthleteOnboarding.entryOnboardingStep,
      productConsentAccepted: nextAthleteOnboarding.productConsentAccepted,
      requiredConsentIds,
      completedConsentIds: nextAthleteOnboarding.completedConsentIds,
      researchConsentStatus: nextAthleteOnboarding.researchConsentStatus,
      studyMode,
    });

    const teamMembershipId = `${args.teamId}_${userId}`;
    const pilotEnrollmentId = `${args.pilotId}_${userId}`;

    results.push({
      email,
      userId,
      lookupSource: userRecord.source,
      onboardingStatus: completion.onboardingStatus,
      enrollmentStatus: completion.enrollmentStatus,
      productConsentAccepted: nextAthleteOnboarding.productConsentAccepted,
      researchConsentStatus: nextAthleteOnboarding.researchConsentStatus,
      baselinePathStatus: nextAthleteOnboarding.baselinePathStatus,
      completedConsentIds: nextAthleteOnboarding.completedConsentIds.length,
    });

    if (args.dryRun) {
      continue;
    }

    const teamMembershipRef = db.collection(TEAM_MEMBERSHIPS_COLLECTION).doc(teamMembershipId);
    const pilotEnrollmentRef = db.collection(PILOT_ENROLLMENTS_COLLECTION).doc(pilotEnrollmentId);
    const userRef = db.collection(USERS_COLLECTION).doc(userId);

    await db.runTransaction(async (transaction) => {
      const [existingMembershipSnap, existingEnrollmentSnap] = await Promise.all([
        transaction.get(teamMembershipRef),
        transaction.get(pilotEnrollmentRef),
      ]);

      const existingMembership = existingMembershipSnap.exists ? existingMembershipSnap.data() || {} : {};
      const existingEnrollment = existingEnrollmentSnap.exists ? existingEnrollmentSnap.data() || {} : {};

      transaction.set(
        teamMembershipRef,
        {
          organizationId,
          teamId: args.teamId,
          userId,
          email,
          role: 'athlete',
          title: existingMembership.title || null,
          permissionSetId: existingMembership.permissionSetId || ATHLETE_PERMISSION_SET_ID,
          rosterVisibilityScope: 'none',
          allowedAthleteIds: [],
          athleteOnboarding: nextAthleteOnboarding,
          onboardingStatus: completion.onboardingStatus,
          commercialAccess: commercialSnapshot,
          grantedByInviteToken: normalizeString(args.grantSource),
          grantedAt: existingMembership.grantedAt || FieldValue.serverTimestamp(),
          createdAt: existingMembership.createdAt || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(
        pilotEnrollmentRef,
        {
          organizationId,
          teamId: args.teamId,
          pilotId: args.pilotId,
          cohortId,
          userId,
          teamMembershipId,
          studyMode,
          enrollmentMode: nextAthleteOnboarding.enrollmentMode,
          status: completion.enrollmentStatus,
          productConsentAccepted: nextAthleteOnboarding.productConsentAccepted,
          productConsentAcceptedAt:
            existingEnrollment.productConsentAcceptedAt || nextAthleteOnboarding.productConsentAcceptedAt || null,
          productConsentVersion:
            normalizeString(existingEnrollment.productConsentVersion) || nextAthleteOnboarding.productConsentVersion || '',
          researchConsentStatus: nextAthleteOnboarding.researchConsentStatus,
          researchConsentVersion:
            normalizeString(existingEnrollment.researchConsentVersion) || nextAthleteOnboarding.researchConsentVersion || '',
          researchConsentRespondedAt:
            existingEnrollment.researchConsentRespondedAt || nextAthleteOnboarding.researchConsentRespondedAt || null,
          requiredConsentIds,
          completedConsentIds: nextAthleteOnboarding.completedConsentIds,
          eligibleForResearchDataset: nextAthleteOnboarding.eligibleForResearchDataset,
          grantedByInviteToken: normalizeString(args.grantSource),
          createdAt: existingEnrollment.createdAt || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(
        userRef,
        {
          ...seedUserPatch,
          pulseCheckTeamCommercialAccess: commercialSnapshot,
          onboardInvite: {
            ...(userData.onboardInvite || {}),
            source: 'pulsecheck-manual-existing-app-attach',
            organizationId,
            teamId: args.teamId,
            pilotId: args.pilotId,
            cohortId,
            teamMembershipRole: 'athlete',
            capturedAt: Math.floor(Date.now() / 1000),
          },
          updatedAt: new Date(),
        },
        { merge: true }
      );
    });
  }

  console.log('\nResults');
  for (const row of results) {
    console.log(JSON.stringify(row));
  }

  const missingUsers = results.filter((row) => row.status === 'missing-user');
  const ready = results.filter((row) => !row.status);
  console.log(`\nMatched users: ${ready.length}`);
  console.log(`Missing users: ${missingUsers.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
