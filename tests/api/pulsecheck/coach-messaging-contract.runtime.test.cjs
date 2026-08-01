const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const {
  MAX_MESSAGE_LENGTH,
  buildCoachAthletePushData,
  isStalePushTokenError,
  resolveCoachAthleteMessageEnvelope,
  resolvePulseCheckPushTargets,
  resolvePulseCheckSenderName,
} = require('../../../functions/utils/coachAthleteMessageContract');

const modernConversation = {
  coachId: 'coach-1',
  athleteId: 'athlete-1',
  teamId: 'team-1',
  organizationId: 'org-1',
  participantIds: ['athlete-1', 'coach-1'],
  coachName: 'Coach Taylor',
  athleteName: 'Jordan',
};

test('coach and athlete messages resolve the opposite exact participant', () => {
  const coachEnvelope = resolveCoachAthleteMessageEnvelope({
    conversationId: 'conversation-1',
    senderId: 'coach-1',
    senderType: 'coach',
    content: 'Practice starts at five.',
    messageType: 'text',
  }, modernConversation);
  assert.equal(coachEnvelope.recipientId, 'athlete-1');
  assert.equal(coachEnvelope.senderName, 'Coach Taylor');

  const athleteEnvelope = resolveCoachAthleteMessageEnvelope({
    conversationId: 'conversation-1',
    senderId: 'athlete-1',
    senderType: 'athlete',
    content: 'I will be there.',
    messageType: 'text',
  }, modernConversation);
  assert.equal(athleteEnvelope.recipientId, 'coach-1');
  assert.equal(athleteEnvelope.senderName, 'Jordan');
});

test('message notification validation rejects forged or malformed scope', () => {
  assert.equal(resolveCoachAthleteMessageEnvelope({
    conversationId: 'conversation-1',
    senderId: 'athlete-1',
    senderType: 'coach',
    content: 'Forged sender type',
  }, modernConversation), null);

  assert.equal(resolveCoachAthleteMessageEnvelope({
    conversationId: 'conversation-1',
    senderId: 'coach-1',
    senderType: 'coach',
    content: 'x'.repeat(MAX_MESSAGE_LENGTH + 1),
  }, modernConversation), null);

  assert.equal(resolveCoachAthleteMessageEnvelope({
    conversationId: 'conversation-1',
    senderId: 'coach-1',
    senderType: 'coach',
    content: 'Wrong participants',
  }, {
    ...modernConversation,
    participantIds: ['coach-1', 'athlete-2'],
  }), null);
});

test('legacy participant-only conversations keep notification compatibility', () => {
  const envelope = resolveCoachAthleteMessageEnvelope({
    conversationId: 'legacy-conversation',
    senderId: 'athlete-1',
    senderType: 'athlete',
    content: 'Can we review today?',
  }, {
    coachId: 'coach-1',
    athleteId: 'athlete-1',
    coachName: 'Coach Taylor',
    athleteName: 'Jordan',
  });

  assert.equal(envelope.recipientId, 'coach-1');
  assert.equal(envelope.teamId, '');
  assert.equal(envelope.organizationId, '');
});

test('push data matches the native COACH_MESSAGE contract', () => {
  const envelope = resolveCoachAthleteMessageEnvelope({
    conversationId: 'conversation-1',
    senderId: 'coach-1',
    senderType: 'coach',
    content: 'Practice starts at five.',
  }, modernConversation);
  const data = buildCoachAthletePushData({
    envelope,
    messageId: 'message-1',
    messagePreview: 'Practice starts at five.',
    timestamp: '2026-07-31T12:00:00.000Z',
  });

  assert.deepEqual(data, {
    type: 'COACH_MESSAGE',
    conversationId: 'conversation-1',
    senderId: 'coach-1',
    senderType: 'coach',
    recipientId: 'athlete-1',
    coachId: 'coach-1',
    athleteId: 'athlete-1',
    teamId: 'team-1',
    organizationId: 'org-1',
    message: 'Practice starts at five.',
    messageId: 'message-1',
    timestamp: '2026-07-31T12:00:00.000Z',
  });
  assert.ok(Object.values(data).every((value) => typeof value === 'string'));
});

const pushRecord = ({id, ownerUserId, token, updatedAt}) => ({
  id,
  data: {
    ownerUserId,
    installationId: id,
    token,
    sourceApp: 'pulsecheck',
    platform: 'ios',
    updatedAt,
  },
});

test('push resolution delivers to every currently claimed installation', () => {
  const installationRecords = [
    pushRecord({
      id: 'installation_device_one_123',
      ownerUserId: 'coach-1',
      token: 'token-one',
      updatedAt: 100,
    }),
    pushRecord({
      id: 'installation_device_two_456',
      ownerUserId: 'coach-1',
      token: 'token-two',
      updatedAt: 200,
    }),
  ];
  const resolved = resolvePulseCheckPushTargets({
    recipientId: 'coach-1',
    userData: {pulseCheckPushTokenModelVersion: 2},
    installationRecords,
    claimRecords: installationRecords,
  });

  assert.deepEqual(
    resolved.targets.map(({token}) => token).sort(),
    ['token-one', 'token-two']
  );
});

test('newest token claim suppresses stale cross-account message previews', () => {
  const oldInstallation = pushRecord({
    id: 'installation_old_account_123',
    ownerUserId: 'old-user',
    token: 'shared-device-token',
    updatedAt: 100,
  });
  const newClaim = pushRecord({
    id: 'installation_new_account_456',
    ownerUserId: 'new-user',
    token: 'shared-device-token',
    updatedAt: 200,
  });
  const resolved = resolvePulseCheckPushTargets({
    recipientId: 'old-user',
    userData: {pulseCheckPushTokenModelVersion: 2},
    installationRecords: [oldInstallation],
    claimRecords: [oldInstallation, newClaim],
  });

  assert.deepEqual(resolved.targets, []);
});

test('legacy push fallback is exact-source only and fails closed after migration', () => {
  const legacyUser = {
    pulseCheckFcmToken: 'legacy-token',
    pushTokenSourceApp: 'pulsecheck',
  };
  assert.equal(resolvePulseCheckPushTargets({
    recipientId: 'athlete-1',
    userData: legacyUser,
  }).targets[0].token, 'legacy-token');

  assert.deepEqual(resolvePulseCheckPushTargets({
    recipientId: 'athlete-1',
    userData: {
      ...legacyUser,
      pulseCheckPushTokenModelVersion: 2,
    },
  }).targets, []);

  assert.deepEqual(resolvePulseCheckPushTargets({
    recipientId: 'athlete-1',
    userData: {
      pulseCheckFcmToken: 'legacy-token',
      pushTokenSourceApp: 'another-app',
    },
  }).targets, []);
});

test('stale FCM response codes are cleanup eligible', () => {
  assert.equal(isStalePushTokenError({
    code: 'messaging/registration-token-not-registered',
  }), true);
  assert.equal(isStalePushTokenError({code: 'messaging/internal-error'}), false);
});

test('push sender name comes from sender identity, not conversation input', () => {
  assert.equal(resolvePulseCheckSenderName({
    displayName: 'Verified Coach',
  }, 'coach'), 'Verified Coach');
  assert.equal(resolvePulseCheckSenderName({}, 'coach'), 'Your coach');
});

test('Firestore rules preserve legacy summaries and validate new message shape', () => {
  const rules = read('firestore.rules');
  assert.match(rules, /function pcConversationParticipantsAreImmutable/);
  assert.match(
    rules,
    /!\('participantIds' in before\)[\s\S]*!\('participantIds' in after\)/
  );
  assert.match(rules, /function pcDirectMessageCreateIsValid/);
  assert.match(rules, /function pcCanReadConversation/);
  assert.match(rules, /function pcCanWriteConversation/);
  assert.match(rules, /data\.athleteId == request\.auth\.uid/);
  assert.match(rules, /function pcConversationSenderSummaryUpdateIsValid/);
  assert.match(rules, /function pcConversationSelfReadResetIsValid/);
  assert.match(rules, /existsAfter\(pcMessagePath\(after\.lastMessageId\)\)/);
  assert.match(rules, /message\.content == after\.lastMessage/);
  assert.match(rules, /data\.lastMessageId == ''/);
  assert.match(rules, /pcModernConversationIdMatchesScope/);
  assert.match(rules, /conversationId == 'pcv2_'/);
  assert.match(rules, /allow get:[\s\S]*pcCanGetMissingDeterministicConversation/);
  assert.match(rules, /allow list:[^;]*pcCanReadConversation/);
  assert.match(rules, /data\.content\.size\(\) <= 4000/);
  assert.match(rules, /data\.readBy\.keys\(\)\.hasOnly\(\[request\.auth\.uid\]\)/);
  assert.match(rules, /data\.messageType in \['text', 'image', 'file'\]/);
  assert.match(rules, /pcModernConversationCreateIsValid\(request\.resource\.data\)/);
  assert.match(
    rules,
    /request\.resource\.data\.coachId == request\.auth\.uid[\s\S]*request\.resource\.data\.athleteId == request\.auth\.uid/
  );
  const messageRules = rules.slice(
    rules.indexOf('match /coach-athlete-messages/{messageId}'),
    rules.indexOf('// Payment/order truth')
  );
  assert.match(messageRules, /allow read:[\s\S]*pcCanReadConversation/);
  assert.match(
    messageRules,
    /allow create:[\s\S]*pcDirectMessageMatchesConversationTransition/
  );
  assert.match(messageRules, /allow update:[\s\S]*pcCanWriteConversation/);
  assert.match(
    messageRules,
    /pcDirectMessageMatchesConversationTransition\([\s\S]*messageId/
  );
  assert.match(
    rules,
    /match \/users\/\{userId\}\/pulsecheckPushTokens\/\{installationId\}/
  );
  assert.match(
    rules,
    /match \/pulsecheck-push-installations\/\{installationId\}/
  );
  assert.match(rules, /function isSafeOwnPulseCheckPushMetadataUpdate/);
  assert.match(
    rules,
    /affected\.hasOnly\([\s\S]*pulseCheckPushTokenModelVersion/
  );
});

test('web writer uses exact modern scope and marks missing read receipts', () => {
  const source = read('src/api/firebase/messaging/coachAthleteService.ts');
  assert.match(
    source,
    /where\('coachId', '==', coachId\)[\s\S]*where\('athleteId', '==', athleteId\)[\s\S]*where\('teamId', '==', teamId\)[\s\S]*where\('organizationId', '==', organizationId\)/
  );
  const scopeGuardIndex = source.indexOf('if (!hasTeamScope)');
  const queryIndex = source.indexOf('const existingQuery = query(');
  const queryEndIndex = source.indexOf('const existingSnapshot', queryIndex);
  const querySource = source.slice(queryIndex, queryEndIndex);
  assert.ok(scopeGuardIndex >= 0 && scopeGuardIndex < queryIndex);
  assert.match(querySource, /where\('coachId', '==', coachId\)/);
  assert.match(querySource, /where\('athleteId', '==', athleteId\)/);
  assert.match(querySource, /where\('teamId', '==', teamId\)/);
  assert.match(querySource, /where\('organizationId', '==', organizationId\)/);
  assert.doesNotMatch(source, /const existingQuery = hasTeamScope/);
  assert.doesNotMatch(source, /The coach must start this conversation/);
  assert.match(source, /pcv2_/);
  assert.match(source, /scope\.join\('~'\)/);
  assert.match(source, /runTransaction/);
  assert.match(source, /lastMessageId: messageDoc\.id/);
  assert.match(source, /auth\.currentUser\?\.uid !== senderId/);
  assert.match(source, /expectedSenderId !== senderId/);
  assert.doesNotMatch(source, /where\(`readBy\.\$\{userId\}`, '==', null\)/);
  assert.match(source, /data\.senderId !== userId && readBy\[userId\] == null/);
  assert.match(source, /index \+= 400/);
});

test('committed indexes cover native thread and web scoped lookup queries', () => {
  const conversationIndexes = JSON.parse(read('firestore.indexes.json')).indexes
    .filter((entry) => entry.collectionGroup === 'coach-athlete-conversations');
  const indexes = conversationIndexes.map(
    (entry) => entry.fields.map((field) => field.fieldPath)
  );

  assert.ok(conversationIndexes.some((index) => (
    index.queryScope === 'COLLECTION'
      && index.fields.map(({fieldPath, order}) => `${fieldPath}:${order}`).join(',')
        === [
          'coachId:ASCENDING',
          'organizationId:ASCENDING',
          'teamId:ASCENDING',
          'lastMessageTimestamp:DESCENDING',
        ].join(',')
  )));
  assert.ok(indexes.some((fields) => (
    fields.join(',')
      === 'coachId,teamId,organizationId,athleteId,lastMessageTimestamp'
  )));
  assert.ok(indexes.some((fields) => (
    fields.join(',') === 'coachId,athleteId,teamId,organizationId'
  )));

  const messageIndex = JSON.parse(read('firestore.indexes.json')).indexes.find(
    (entry) => entry.collectionGroup === 'coach-athlete-messages'
      && entry.fields.map((field) => field.fieldPath).join(',')
        === 'conversationId,timestamp'
  );
  assert.ok(messageIndex);
});

test('notification trigger validates the shared contract before push', () => {
  const source = read('functions/coachAthleteMessageNotifications.js');
  const indexSource = read('functions/index.js');
  assert.match(source, /resolveCoachAthleteMessageEnvelope/);
  assert.match(source, /if \(!envelope\)/);
  assert.match(source, /buildCoachAthletePushData/);
  assert.match(source, /sendEachForMulticast/);
  assert.match(source, /pulsecheckPushTokens/);
  assert.match(source, /pulsecheck-push-installations/);
  assert.match(source, /cleanupStalePushTargets/);
  assert.match(source, /logPushSendFailures/);
  assert.ok(source.includes('messaging/third-party-auth-error'));
  assert.match(source, /resolvePulseCheckSenderName/);
  assert.match(indexSource, /exports\.sendCoachAthleteMessageNotification/);
});
