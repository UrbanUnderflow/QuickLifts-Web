const {onDocumentCreated, onDocumentUpdated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const {
  cleanupStalePushTargets,
  loadPulseCheckPushTargets,
  logPushSendFailures,
} = require('./utils/pulsecheckPushTargets');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const COACH_NOTIFICATIONS_COLLECTION = 'coach-notifications';
const TEAM_MEMBERSHIPS_COLLECTION = 'pulsecheck-team-memberships';
const TEAMS_COLLECTION = 'pulsecheck-teams';
const CHECKINS_ROOT = 'mental-check-ins';
const ATHLETE_APP_REVENUE_EVENTS_COLLECTION = 'pulsecheck-athlete-app-revenue-events';
const PULSECHECK_REVENUE_EVENTS_COLLECTION = 'pulsecheck-revenue-events';

const cleanString = (value) => (
  typeof value === 'string' && value.trim() ? value.trim() : ''
);

const lowerString = (value) => cleanString(value).toLowerCase();

const uniqueStrings = (values) => (
  [...new Set((Array.isArray(values) ? values : []).map(cleanString).filter(Boolean))]
);

const sanitizeDocId = (value) => (
  cleanString(value).replace(/[^\w.-]+/g, '_').slice(0, 1200) || `event_${Date.now()}`
);

const timestampValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (value && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  return Date.now();
};

const firstCleanString = (...values) => (
  values.map(cleanString).find(Boolean) || ''
);

function userDisplayName(userData = {}, fallback = 'Athlete') {
  const firstLast = [userData.firstName, userData.lastName]
    .map(cleanString)
    .filter(Boolean)
    .join(' ');
  return firstCleanString(
    userData.displayName,
    userData.fullName,
    userData.name,
    firstLast,
    userData.username,
    fallback
  ).slice(0, 80);
}

function teamDisplayName(teamData = {}) {
  return firstCleanString(
    teamData.displayName,
    teamData.name,
    teamData.teamName,
    'your team'
  ).slice(0, 100);
}

function isActiveRecord(data = {}) {
  if (!data || data.revoked === true || data.revokedAt || data.deletedAt || data.archivedAt) {
    return false;
  }
  const status = lowerString(data.status);
  return !status || status === 'active';
}

function isAthleteMembership(data = {}) {
  return lowerString(data.role) === 'athlete' && isActiveRecord(data);
}

function staffMembershipCanSeeAthlete(membership = {}, athleteId = '') {
  const role = lowerString(membership.role);
  const capabilities = Array.isArray(membership.staffCapabilities)
    ? membership.staffCapabilities.map(lowerString).filter(Boolean)
    : [];
  const canCoach = role === 'team-admin'
    || role === 'coach'
    || role === 'performance-staff'
    || role === 'support-staff'
    || capabilities.includes('admin')
    || capabilities.includes('coaching');
  const rosterScope = lowerString(membership.rosterVisibilityScope);
  const canSeeAthlete = !rosterScope
    || rosterScope === 'team'
    || (
      rosterScope === 'assigned'
      && Array.isArray(membership.allowedAthleteIds)
      && membership.allowedAthleteIds.includes(athleteId)
    );
  return isActiveRecord(membership) && canCoach && canSeeAthlete;
}

function isActiveTeamMembership(data = {}) {
  return Boolean(cleanString(data.userId)) && isActiveRecord(data);
}

async function loadUserData(userId) {
  if (!userId) {
    return {};
  }
  const snap = await db.collection('users').doc(userId).get();
  return snap.exists ? snap.data() || {} : {};
}

async function loadTeamData(teamId) {
  if (!teamId) {
    return {};
  }
  const snap = await db.collection(TEAMS_COLLECTION).doc(teamId).get();
  return snap.exists ? snap.data() || {} : {};
}

async function loadCoachIdsForTeam({teamId, athleteId, extraCoachIds = []}) {
  if (!teamId) {
    return uniqueStrings(extraCoachIds);
  }
  const membershipSnap = await db.collection(TEAM_MEMBERSHIPS_COLLECTION)
    .where('teamId', '==', teamId)
    .get();
  const coachIds = uniqueStrings(extraCoachIds);

  membershipSnap.docs.forEach((document) => {
    const membership = document.data() || {};
    const coachId = cleanString(membership.userId);
    if (coachId && coachId !== athleteId && staffMembershipCanSeeAthlete(membership, athleteId)) {
      coachIds.push(coachId);
    }
  });

  return uniqueStrings(coachIds);
}

async function loadActiveTeamMemberIds(teamId) {
  if (!teamId) {
    return [];
  }

  const membershipSnap = await db.collection(TEAM_MEMBERSHIPS_COLLECTION)
    .where('teamId', '==', teamId)
    .get();
  return uniqueStrings(
    membershipSnap.docs
      .map((document) => document.data() || {})
      .filter(isActiveTeamMembership)
      .map((membership) => membership.userId)
  );
}

async function upsertCoachNotification(notificationId, payload) {
  const now = Date.now();
  await db.collection(COACH_NOTIFICATIONS_COLLECTION)
    .doc(sanitizeDocId(notificationId))
    .set({
      read: false,
      archived: false,
      actionRequired: false,
      createdAt: now,
      updatedAt: now,
      ...payload,
    }, {merge: true});
}

async function fanOutCoachNotification({
  notificationKey,
  coachIds,
  type,
  category = 'athlete',
  title,
  message,
  teamId = '',
  organizationId = '',
  athleteId = '',
  sourceId = '',
  target = 'coach_dashboard',
  webUrl = 'https://fitwithpulse.ai/coach/dashboard',
  metadata = {},
  actionRequired = false,
  suppressPush = false,
}) {
  const cleanCoachIds = uniqueStrings(coachIds);
  await Promise.all(cleanCoachIds.map((coachId) => upsertCoachNotification(
    `${notificationKey}_${coachId}`,
    {
      type,
      category,
      coachId,
      athleteId,
      teamId,
      organizationId,
      title,
      message,
      actionRequired,
      sourceId,
      target,
      webUrl,
      suppressPush,
      metadata: {
        ...metadata,
        teamId,
        organizationId,
      },
    }
  )));
  return cleanCoachIds.length;
}

function pushDataPayload(notificationId, notification = {}) {
  const data = {
    type: 'COACH_NOTIFICATION',
    notificationId,
    coachNotificationType: notification.type,
    category: notification.category,
    coachId: notification.coachId,
    athleteId: notification.athleteId,
    teamId: notification.teamId,
    organizationId: notification.organizationId,
    sourceId: notification.sourceId,
    target: notification.target,
    webUrl: notification.webUrl,
    timestamp: String(timestampValue(notification.createdAt)),
  };

  return Object.entries(data).reduce((payload, [key, value]) => {
    const text = typeof value === 'string' ? value : String(value || '');
    if (text) {
      payload[key] = text;
    }
    return payload;
  }, {});
}

function teamLeaderboardPushData({
  eventType,
  sprintId,
  teamId,
  teamName,
  actorAthleteId,
  recipientId,
  throughDate,
  previousRank = '',
  newRank = '',
  totalPoints = '',
}) {
  const data = {
    type: 'TEAM_LEADERBOARD',
    leaderboardEventType: eventType,
    sprintId,
    teamId,
    teamName,
    actorAthleteId,
    recipientId,
    throughDate,
    previousRank,
    newRank,
    totalPoints,
    target: 'team_showing_up',
  };

  return Object.entries(data).reduce((payload, [key, value]) => {
    const text = String(value ?? '').trim();
    if (text) {
      payload[key] = text;
    }
    return payload;
  }, {});
}

async function sendPulseCheckPushToUser({
  recipientId,
  title,
  message,
  data,
  channelId = 'team_leaderboard',
  apnsCategory = 'TEAM_LEADERBOARD_CATEGORY',
}) {
  const userRef = db.collection('users').doc(recipientId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return {recipientId, successCount: 0, failureCount: 0, skipped: 'user_not_found'};
  }

  const {targets} = await loadPulseCheckPushTargets(
    recipientId,
    userRef,
    userSnap.data() || {}
  );
  if (targets.length === 0) {
    return {recipientId, successCount: 0, failureCount: 0, skipped: 'no_pulsecheck_push_targets'};
  }

  const payload = {
    tokens: targets.map(({token}) => token),
    notification: {title, body: message},
    data,
    apns: {
      headers: {'apns-priority': '10'},
      payload: {
        aps: {
          alert: {title, body: message},
          badge: 1,
          sound: 'default',
          category: apnsCategory,
        },
      },
    },
    android: {
      notification: {
        channelId,
        priority: 'high',
        defaultSound: true,
        defaultVibrateTimings: true,
      },
    },
  };

  const response = await admin.messaging().sendEachForMulticast(payload);
  logPushSendFailures(
    'PulseCheck team leaderboard',
    recipientId,
    targets,
    response.responses
  );
  await cleanupStalePushTargets(
    recipientId,
    userRef,
    targets,
    response.responses
  );

  return {
    recipientId,
    successCount: response.successCount,
    failureCount: response.failureCount,
    skipped: '',
  };
}

async function fanOutTeamLeaderboardPush({
  recipientIds,
  title,
  message,
  eventType,
  sprintId,
  teamId,
  teamName,
  actorAthleteId,
  throughDate,
  previousRank = '',
  newRank = '',
  totalPoints = '',
}) {
  const results = await Promise.allSettled(uniqueStrings(recipientIds).map((recipientId) => (
    sendPulseCheckPushToUser({
      recipientId,
      title,
      message,
      data: teamLeaderboardPushData({
        eventType,
        sprintId,
        teamId,
        teamName,
        actorAthleteId,
        recipientId,
        throughDate,
        previousRank,
        newRank,
        totalPoints,
      }),
    })
  )));

  const summary = {
    recipientCount: 0,
    successCount: 0,
    failureCount: 0,
    skippedCount: 0,
  };
  results.forEach((result) => {
    if (result.status !== 'fulfilled') {
      summary.failureCount += 1;
      console.error('PulseCheck team leaderboard push failed before send', result.reason);
      return;
    }
    summary.recipientCount += 1;
    summary.successCount += result.value.successCount || 0;
    summary.failureCount += result.value.failureCount || 0;
    if (result.value.skipped) {
      summary.skippedCount += 1;
    }
  });
  return summary;
}

exports.onCoachNotificationCreated = onDocumentCreated(
  `${COACH_NOTIFICATIONS_COLLECTION}/{notificationId}`,
  async (event) => {
    const notification = event.data?.data();
    if (!notification) {
      return null;
    }

    if (notification.suppressPush === true || notification.pushDisabled === true) {
      await event.data.ref.set({
        pushSkippedReason: 'suppressed',
        pushProcessedAt: Date.now(),
        updatedAt: Date.now(),
      }, {merge: true});
      return null;
    }

    const coachId = cleanString(notification.coachId);
    const title = cleanString(notification.title);
    const message = cleanString(notification.message);
    if (!coachId || !title || !message) {
      await event.data.ref.set({
        pushSkippedReason: 'missing_required_fields',
        pushProcessedAt: Date.now(),
        updatedAt: Date.now(),
      }, {merge: true});
      return null;
    }

    const userRef = db.collection('users').doc(coachId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await event.data.ref.set({
        pushSkippedReason: 'coach_not_found',
        pushProcessedAt: Date.now(),
        updatedAt: Date.now(),
      }, {merge: true});
      return null;
    }

    const {targets} = await loadPulseCheckPushTargets(
      coachId,
      userRef,
      userSnap.data() || {}
    );
    if (targets.length === 0) {
      await event.data.ref.set({
        pushSkippedReason: 'no_pulsecheck_push_targets',
        pushProcessedAt: Date.now(),
        updatedAt: Date.now(),
      }, {merge: true});
      return null;
    }

    const payload = {
      tokens: targets.map(({token}) => token),
      notification: {title, body: message},
      data: pushDataPayload(event.params.notificationId, notification),
      apns: {
        headers: {'apns-priority': '10'},
        payload: {
          aps: {
            alert: {title, body: message},
            badge: 1,
            sound: 'default',
            category: 'COACH_NOTIFICATION_CATEGORY',
          },
        },
      },
      android: {
        notification: {
          channelId: 'coach_events',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(payload);
    logPushSendFailures(
      'PulseCheck coach event',
      coachId,
      targets,
      response.responses
    );
    await cleanupStalePushTargets(coachId, userRef, targets, response.responses);

    await event.data.ref.set({
      pushProcessed: true,
      pushProcessedAt: Date.now(),
      pushSuccessCount: response.successCount,
      pushFailureCount: response.failureCount,
      updatedAt: Date.now(),
    }, {merge: true});
    return null;
  }
);

async function notifyTeamJoin({membershipId, membership}) {
  const athleteId = cleanString(membership.userId);
  const teamId = cleanString(membership.teamId);
  if (!teamId || !athleteId || !isAthleteMembership(membership)) {
    return null;
  }

  const [athleteData, teamData] = await Promise.all([
    loadUserData(athleteId),
    loadTeamData(teamId),
  ]);
  const athleteName = userDisplayName(athleteData);
  const teamName = teamDisplayName(teamData);
  const coachIds = await loadCoachIdsForTeam({
    teamId,
    athleteId,
    extraCoachIds: [membership.coachId, membership.createdBy, membership.grantedBy],
  });

  return fanOutCoachNotification({
    notificationKey: sanitizeDocId(`pulsecheck_team_join_${membershipId}`),
    coachIds,
    type: 'pulsecheck_team_join',
    category: 'athlete',
    title: 'New athlete joined',
    message: `${athleteName} joined ${teamName}.`,
    teamId,
    organizationId: cleanString(membership.organizationId),
    athleteId,
    sourceId: membershipId,
    target: 'coach_roster',
    webUrl: 'https://fitwithpulse.ai/coach/dashboard?tab=roster',
  });
}

exports.onPulseCheckTeamMembershipCreated = onDocumentCreated(
  `${TEAM_MEMBERSHIPS_COLLECTION}/{membershipId}`,
  async (event) => {
    const membership = event.data?.data();
    if (!membership) {
      return null;
    }
    return notifyTeamJoin({
      membershipId: event.params.membershipId,
      membership,
    });
  }
);

exports.onPulseCheckTeamMembershipUpdated = onDocumentUpdated(
  `${TEAM_MEMBERSHIPS_COLLECTION}/{membershipId}`,
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) {
      return null;
    }

    const becameActiveAthlete = !isAthleteMembership(before) && isAthleteMembership(after);
    if (!becameActiveAthlete) {
      return null;
    }

    return notifyTeamJoin({
      membershipId: event.params.membershipId,
      membership: after,
    });
  }
);

exports.onPulseCheckMentalCheckInCreated = onDocumentCreated(
  `${CHECKINS_ROOT}/{athleteId}/check-ins/{checkInId}`,
  async (event) => {
    const checkIn = event.data?.data();
    if (!checkIn) {
      return null;
    }

    const athleteId = cleanString(event.params.athleteId || checkIn.userId);
    if (!athleteId) {
      return null;
    }

    const membershipSnap = await db.collection(TEAM_MEMBERSHIPS_COLLECTION)
      .where('userId', '==', athleteId)
      .get();
    const athleteMemberships = membershipSnap.docs
      .map((document) => ({id: document.id, ...(document.data() || {})}))
      .filter(isAthleteMembership);

    if (athleteMemberships.length === 0) {
      return null;
    }

    const athleteData = await loadUserData(athleteId);
    const athleteName = userDisplayName(athleteData);
    const moodWord = cleanString(checkIn.moodWord);
    const readinessScore = Number(checkIn.readinessScore);
    const checkInType = lowerString(checkIn.type) || 'check-in';
    const sourceDate = cleanString(checkIn.date);
    const scoreText = Number.isFinite(readinessScore)
      ? ` Readiness: ${Math.round(readinessScore)}.`
      : '';
    const moodText = moodWord ? ` feeling ${moodWord}` : '';

    let sentCount = 0;
    for (const membership of athleteMemberships) {
      const teamId = cleanString(membership.teamId);
      const coachIds = await loadCoachIdsForTeam({teamId, athleteId});
      sentCount += await fanOutCoachNotification({
        notificationKey: sanitizeDocId(`pulsecheck_checkin_${event.params.checkInId}_${teamId}`),
        coachIds,
        type: 'pulsecheck_checkin',
        category: 'athlete',
        title: `${athleteName} checked in`,
        message: `${athleteName} completed a ${checkInType}${moodText}.${scoreText}`.trim(),
        teamId,
        organizationId: cleanString(membership.organizationId),
        athleteId,
        sourceId: event.params.checkInId,
        target: 'coach_readiness',
        webUrl: 'https://fitwithpulse.ai/coach/mentalGames?tab=readiness',
        metadata: {
          sourceDate,
          checkInType,
          readinessScore: Number.isFinite(readinessScore) ? Math.round(readinessScore) : null,
        },
      });
    }
    return {coachNotificationCount: sentCount};
  }
);

exports.onPulseCheckAthleteAppRevenueEventCreated = onDocumentCreated(
  `${ATHLETE_APP_REVENUE_EVENTS_COLLECTION}/{eventId}`,
  async (event) => {
    const revenueEvent = event.data?.data();
    if (!revenueEvent) {
      return null;
    }

    if (
      lowerString(revenueEvent.type) !== 'athlete_app_subscription_invoice'
      || lowerString(revenueEvent.status) !== 'paid'
    ) {
      return null;
    }

    const athleteId = cleanString(revenueEvent.userId);
    const teamId = cleanString(revenueEvent.teamId);
    if (!athleteId || !teamId) {
      return null;
    }

    const [athleteData, teamData] = await Promise.all([
      loadUserData(athleteId),
      loadTeamData(teamId),
    ]);
    const athleteName = userDisplayName(athleteData);
    const teamName = teamDisplayName(teamData);
    const amountPaidCents = Math.max(0, Math.round(Number(revenueEvent.amountPaidCents) || 0));
    const amountText = amountPaidCents > 0
      ? ` ${new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(amountPaidCents / 100)} paid.`
      : '';
    const coachIds = await loadCoachIdsForTeam({
      teamId,
      athleteId,
      extraCoachIds: [revenueEvent.revenueRecipientUserId],
    });

    return fanOutCoachNotification({
      notificationKey: sanitizeDocId(`pulsecheck_subscription_${event.params.eventId}`),
      coachIds,
      type: 'pulsecheck_athlete_subscription',
      category: 'revenue',
      title: 'New PulseCheck subscription',
      message: `${athleteName} subscribed through ${teamName}.${amountText}`.trim(),
      teamId,
      organizationId: cleanString(revenueEvent.organizationId),
      athleteId,
      sourceId: event.params.eventId,
      target: 'coach_earnings',
      webUrl: 'https://fitwithpulse.ai/coach/settings?tab=earnings',
      metadata: {
        amountPaidCents,
        currency: cleanString(revenueEvent.currency) || 'usd',
        stripeInvoiceId: cleanString(revenueEvent.stripeInvoiceId),
        stripeSubscriptionId: cleanString(revenueEvent.stripeSubscriptionId),
      },
    });
  }
);

exports.onPulseCheckRevenueEventCreated = onDocumentCreated(
  `${PULSECHECK_REVENUE_EVENTS_COLLECTION}/{eventId}`,
  async (event) => {
    const revenueEvent = event.data?.data();
    if (!revenueEvent || revenueEvent.active !== true) {
      return null;
    }

    const athleteId = cleanString(
      revenueEvent.subscriberUserId || revenueEvent.userId
    );
    const teamId = cleanString(revenueEvent.teamId);
    if (!athleteId || !teamId) {
      return null;
    }

    const [athleteData, teamData] = await Promise.all([
      loadUserData(athleteId),
      loadTeamData(teamId),
    ]);
    const athleteName = userDisplayName(athleteData);
    const teamName = teamDisplayName(teamData);
    const monthlyRevenueCents = Math.max(
      0,
      Math.round(Number(revenueEvent.monthlyRevenueCents) || 0)
    );
    const amountText = monthlyRevenueCents > 0
      ? ` ${new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(monthlyRevenueCents / 100)} monthly.`
      : '';
    const coachIds = await loadCoachIdsForTeam({
      teamId,
      athleteId,
      extraCoachIds: [
        revenueEvent.revenueRecipientUserId,
        revenueEvent.coachReferralRecipientUserId,
        revenueEvent.billingOwnerUserId,
      ],
    });

    return fanOutCoachNotification({
      notificationKey: sanitizeDocId(`pulsecheck_revenue_subscription_${event.params.eventId}`),
      coachIds,
      type: 'pulsecheck_team_subscription',
      category: 'revenue',
      title: 'New PulseCheck subscription',
      message: `${athleteName} subscribed through ${teamName}.${amountText}`.trim(),
      teamId,
      organizationId: cleanString(revenueEvent.organizationId),
      athleteId,
      sourceId: event.params.eventId,
      target: 'coach_earnings',
      webUrl: 'https://fitwithpulse.ai/coach/settings?tab=earnings',
      metadata: {
        monthlyRevenueCents,
        planType: cleanString(revenueEvent.planType),
        billingInterval: cleanString(revenueEvent.billingInterval),
        stripeSubscriptionId: cleanString(revenueEvent.stripeSubscriptionId),
      },
    });
  }
);

function memberByAthleteId(members = []) {
  const map = new Map();
  if (!Array.isArray(members)) {
    return map;
  }
  members.forEach((member) => {
    const athleteId = cleanString(member?.athleteId || member?.userId);
    if (!athleteId) {
      return;
    }
    map.set(athleteId, {
      athleteId,
      displayName: cleanString(member.displayName) || 'Athlete',
      rank: Math.max(0, Math.round(Number(member.rank) || 0)),
      totalPoints: Math.max(0, Math.round(Number(member.totalPoints) || 0)),
    });
  });
  return map;
}

exports.onPulseCheckTeamShowingUpSprintUpdated = onDocumentUpdated(
  'pulsecheck-team-showing-up-sprints/{sprintId}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) {
      return null;
    }

    const teamId = cleanString(after.teamId);
    if (!teamId) {
      return null;
    }

    const beforeMembers = memberByAthleteId(before.members);
    const afterMembers = memberByAthleteId(after.members);
    const throughDate = cleanString(after.throughDate)
      || cleanString(after.sprintEndDate)
      || String(Date.now());
    const organizationId = cleanString(after.organizationId);
    const coachIdsByTeam = new Map();
    const teamData = await loadTeamData(teamId);
    const teamName = teamDisplayName(teamData);
    const teamMemberIds = await loadActiveTeamMemberIds(teamId);
    let coachNotificationCount = 0;
    let teamPushSuccessCount = 0;
    let teamPushFailureCount = 0;
    let teamPushSkippedCount = 0;

    for (const [athleteId, member] of afterMembers.entries()) {
      const previous = beforeMembers.get(athleteId);
      if (!previous || !previous.rank || !member.rank || previous.rank === member.rank) {
        continue;
      }

      const movedUp = previous.rank > member.rank;
      if (movedUp) {
        const title = member.rank === 1
          ? `New leader: ${member.displayName}`
          : `${member.displayName} moved up`;
        const message = `${member.displayName} moved from #${previous.rank} to #${member.rank} on ${teamName}.`;
        const teamPush = await fanOutTeamLeaderboardPush({
          recipientIds: teamMemberIds,
          title,
          message,
          eventType: 'rank_move',
          sprintId: event.params.sprintId,
          teamId,
          teamName,
          actorAthleteId: athleteId,
          throughDate,
          previousRank: previous.rank,
          newRank: member.rank,
          totalPoints: member.totalPoints,
        });
        teamPushSuccessCount += teamPush.successCount;
        teamPushFailureCount += teamPush.failureCount;
        teamPushSkippedCount += teamPush.skippedCount;
      }

      if (!coachIdsByTeam.has(teamId)) {
        coachIdsByTeam.set(teamId, await loadCoachIdsForTeam({teamId, athleteId}));
      }
      const coachIds = coachIdsByTeam.get(teamId);
      coachNotificationCount += await fanOutCoachNotification({
        notificationKey: sanitizeDocId(
          `pulsecheck_leaderboard_move_${event.params.sprintId}_${throughDate}_${athleteId}_${previous.rank}_to_${member.rank}`
        ),
        coachIds,
        type: movedUp ? 'pulsecheck_leaderboard_move' : 'pulsecheck_leaderboard_rank_change',
        category: 'athlete',
        title: movedUp ? `${member.displayName} moved up` : `${member.displayName}'s rank changed`,
        message: `${member.displayName} moved from #${previous.rank} to #${member.rank} on the showing-up leaderboard.`,
        teamId,
        organizationId,
        athleteId,
        sourceId: event.params.sprintId,
        target: 'coach_leaderboard',
        webUrl: 'https://fitwithpulse.ai/coach/dashboard?tab=leaderboard',
        suppressPush: true,
        metadata: {
          throughDate,
          previousRank: previous.rank,
          newRank: member.rank,
          totalPoints: member.totalPoints,
        },
      });
    }

    const finalizedNow = after.isFinalized === true && before.isFinalized !== true;
    if (finalizedNow) {
      const winnerIds = uniqueStrings(after.winnerAthleteIds);
      for (const athleteId of winnerIds) {
        const member = afterMembers.get(athleteId);
        if (!member) {
          continue;
        }
        const title = 'New leader crowned';
        const message = `${member.displayName} finished #1 on ${teamName}.`;
        const teamPush = await fanOutTeamLeaderboardPush({
          recipientIds: teamMemberIds,
          title,
          message,
          eventType: 'leader_crowned',
          sprintId: event.params.sprintId,
          teamId,
          teamName,
          actorAthleteId: athleteId,
          throughDate,
          newRank: member.rank,
          totalPoints: member.totalPoints,
        });
        teamPushSuccessCount += teamPush.successCount;
        teamPushFailureCount += teamPush.failureCount;
        teamPushSkippedCount += teamPush.skippedCount;

        const coachIds = await loadCoachIdsForTeam({teamId, athleteId});
        coachNotificationCount += await fanOutCoachNotification({
          notificationKey: sanitizeDocId(
            `pulsecheck_leaderboard_winner_${event.params.sprintId}_${athleteId}`
          ),
          coachIds,
          type: 'pulsecheck_leaderboard_winner',
          category: 'athlete',
          title: `${member.displayName} won the sprint`,
          message: `${member.displayName} finished #1 on the showing-up leaderboard.`,
          teamId,
          organizationId,
          athleteId,
          sourceId: event.params.sprintId,
          target: 'coach_leaderboard',
          webUrl: 'https://fitwithpulse.ai/coach/dashboard?tab=leaderboard',
          suppressPush: true,
          metadata: {
            throughDate,
            rank: member.rank,
            totalPoints: member.totalPoints,
          },
        });
      }
    }

    return {
      coachNotificationCount,
      teamPushSuccessCount,
      teamPushFailureCount,
      teamPushSkippedCount,
    };
  }
);
