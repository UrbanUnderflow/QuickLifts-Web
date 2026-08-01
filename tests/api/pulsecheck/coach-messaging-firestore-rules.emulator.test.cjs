const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  after,
  before,
  beforeEach,
  test,
} = require('node:test');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} = require('firebase/firestore');

const repoRoot = path.resolve(__dirname, '../../..');
const projectId = 'demo-pulsecheck-coach-messaging';
const organizationId = 'org-1';
const teamId = 'team-1';
const coachId = 'coach-1';
const athleteId = 'athlete-1';
const otherAthleteId = 'athlete-2';
const conversationId = `pcv2_${organizationId}~${teamId}~${coachId}~${athleteId}`;
const otherConversationId = `pcv2_${organizationId}~${teamId}~${coachId}~${otherAthleteId}`;
const oldTimestamp = Timestamp.fromMillis(Date.UTC(2026, 6, 30, 12));

let testEnv;

const conversationData = ({
  athlete = athleteId,
  id = conversationId,
  team = teamId,
  organization = organizationId,
  unreadCount = {[coachId]: 0, [athlete]: 0},
} = {}) => ({
  id,
  data: {
    coachId,
    athleteId: athlete,
    organizationId: organization,
    teamId: team,
    participantIds: [coachId, athlete],
    coachName: 'Coach Taylor',
    athleteName: athlete === athleteId ? 'Jordan' : 'Casey',
    lastMessage: '',
    lastMessageId: '',
    lastMessageTimestamp: oldTimestamp,
    lastMessageSenderId: '',
    unreadCount,
    createdAt: oldTimestamp,
    updatedAt: oldTimestamp,
  },
});

async function seedBaseData(db) {
  await Promise.all([
    setDoc(doc(db, 'pulsecheck-organizations', organizationId), {
      status: 'active',
    }),
    setDoc(doc(db, 'pulsecheck-teams', teamId), {
      organizationId,
      status: 'active',
    }),
    setDoc(doc(db, 'pulsecheck-team-memberships', `${teamId}_${coachId}`), {
      userId: coachId,
      teamId,
      organizationId,
      role: 'coach',
      status: 'active',
      rosterVisibilityScope: 'assigned',
      allowedAthleteIds: [athleteId],
      staffCapabilities: ['coaching'],
    }),
    setDoc(doc(db, 'pulsecheck-team-memberships', `${teamId}_${athleteId}`), {
      userId: athleteId,
      teamId,
      organizationId,
      role: 'athlete',
      status: 'active',
    }),
    setDoc(doc(db, 'pulsecheck-team-memberships', `${teamId}_${otherAthleteId}`), {
      userId: otherAthleteId,
      teamId,
      organizationId,
      role: 'athlete',
      status: 'active',
    }),
    setDoc(doc(db, 'users', coachId), {
      displayName: 'Coach Taylor',
    }),
    setDoc(doc(db, 'users', athleteId), {
      displayName: 'Jordan',
    }),
  ]);
}

async function seedConversation(db, options) {
  const seeded = conversationData(options);
  await setDoc(
    doc(db, 'coach-athlete-conversations', seeded.id),
    seeded.data
  );
  return seeded;
}

function initialConversationWrite(athlete = athleteId) {
  return {
    coachId,
    athleteId: athlete,
    organizationId,
    teamId,
    participantIds: [coachId, athlete],
    coachName: 'Coach Taylor',
    athleteName: athlete === athleteId ? 'Jordan' : 'Casey',
    lastMessage: '',
    lastMessageId: '',
    lastMessageTimestamp: serverTimestamp(),
    lastMessageSenderId: '',
    unreadCount: {[coachId]: 0, [athlete]: 0},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function messageWrite({
  conversation = conversationId,
  sender = coachId,
  senderType = 'coach',
  content = 'Practice starts at five.',
} = {}) {
  return {
    conversationId: conversation,
    senderId: sender,
    senderType,
    content,
    timestamp: serverTimestamp(),
    readBy: {[sender]: serverTimestamp()},
    messageType: 'text',
  };
}

function installationWrite({owner, installationId, token}) {
  return {
    ownerUserId: owner,
    installationId,
    token,
    sourceApp: 'pulsecheck',
    platform: 'ios',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

async function registerInstallation(db, {owner, installationId, token}) {
  const record = installationWrite({owner, installationId, token});
  const batch = writeBatch(db);
  batch.set(
    doc(db, 'users', owner, 'pulsecheckPushTokens', installationId),
    record,
    {merge: true}
  );
  batch.set(
    doc(db, 'pulsecheck-push-installations', installationId),
    record,
    {merge: true}
  );
  batch.set(doc(db, 'users', owner), {
    pulseCheckPushTokenModelVersion: 2,
    pulseCheckFcmToken: deleteField(),
    pulseCheckFcmTokenOwnerUserId: deleteField(),
    pulseCheckFcmTokenUpdatedAt: deleteField(),
    pushTokenSourceApp: deleteField(),
  }, {merge: true});
  await batch.commit();
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await seedBaseData(context.firestore());
  });
});

after(async () => {
  await testEnv.cleanup();
});

for (const actorId of [coachId, athleteId]) {
  test(`${actorId} can create the one deterministic active conversation`, async () => {
    const db = testEnv.authenticatedContext(actorId).firestore();
    const target = doc(db, 'coach-athlete-conversations', conversationId);

    await assertSucceeds(getDoc(target));
    await assertSucceeds(setDoc(target, initialConversationWrite()));

    const randomTarget = doc(
      db,
      'coach-athlete-conversations',
      'random-conversation-id'
    );
    await assertFails(setDoc(randomTarget, initialConversationWrite()));
  });
}

test('assigned coach inbox queries are roster bounded and index compatible', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await seedConversation(context.firestore());
    await seedConversation(context.firestore(), {
      athlete: otherAthleteId,
      id: otherConversationId,
    });
  });
  const db = testEnv.authenticatedContext(coachId).firestore();
  const conversations = collection(db, 'coach-athlete-conversations');
  const assignedQuery = query(
    conversations,
    where('coachId', '==', coachId),
    where('teamId', '==', teamId),
    where('organizationId', '==', organizationId),
    where('athleteId', 'in', [athleteId]),
    orderBy('lastMessageTimestamp', 'desc')
  );
  const broadQuery = query(
    conversations,
    where('coachId', '==', coachId),
    where('teamId', '==', teamId),
    where('organizationId', '==', organizationId),
    orderBy('lastMessageTimestamp', 'desc')
  );
  const exactThreadQuery = query(
    conversations,
    where('coachId', '==', coachId),
    where('athleteId', '==', athleteId),
    where('teamId', '==', teamId),
    where('organizationId', '==', organizationId)
  );

  const snapshot = await assertSucceeds(getDocs(assignedQuery));
  assert.deepEqual(snapshot.docs.map(({id}) => id), [conversationId]);
  const exactSnapshot = await assertSucceeds(getDocs(exactThreadQuery));
  assert.deepEqual(exactSnapshot.docs.map(({id}) => id), [conversationId]);
  await assertFails(getDocs(broadQuery));

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(
      context.firestore(),
      'pulsecheck-team-memberships',
      `${teamId}_${coachId}`
    ), {
      rosterVisibilityScope: 'team',
      allowedAthleteIds: deleteField(),
    });
  });
  const fullTeamSnapshot = await assertSucceeds(getDocs(broadQuery));
  assert.equal(fullTeamSnapshot.size, 2);
});

test('athlete inbox keeps participant history without granting another athlete access', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await seedConversation(context.firestore(), {
      team: 'retired-team',
      organization: 'retired-org',
    });
  });
  const athleteDb = testEnv.authenticatedContext(athleteId).firestore();
  const otherDb = testEnv.authenticatedContext(otherAthleteId).firestore();
  const athleteInbox = query(
    collection(athleteDb, 'coach-athlete-conversations'),
    where('athleteId', '==', athleteId),
    orderBy('lastMessageTimestamp', 'desc')
  );

  const snapshot = await assertSucceeds(getDocs(athleteInbox));
  assert.equal(snapshot.size, 1);
  await assertFails(getDoc(doc(
    otherDb,
    'coach-athlete-conversations',
    conversationId
  )));
});

test('message send, receive, read receipt, and own unread reset work atomically', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await seedConversation(context.firestore());
  });
  const coachDb = testEnv.authenticatedContext(coachId).firestore();
  const athleteDb = testEnv.authenticatedContext(athleteId).firestore();
  const messageId = 'message-atomic-1';
  const coachConversation = doc(
    coachDb,
    'coach-athlete-conversations',
    conversationId
  );
  const coachMessage = doc(coachDb, 'coach-athlete-messages', messageId);
  const send = writeBatch(coachDb);
  send.set(coachMessage, messageWrite());
  send.update(coachConversation, {
    lastMessage: 'Practice starts at five.',
    lastMessageId: messageId,
    lastMessageSenderId: coachId,
    lastMessageTimestamp: serverTimestamp(),
    unreadCount: {[coachId]: 0, [athleteId]: 1},
    updatedAt: serverTimestamp(),
  });
  await assertSucceeds(send.commit());

  const athleteMessages = query(
    collection(athleteDb, 'coach-athlete-messages'),
    where('conversationId', '==', conversationId),
    orderBy('timestamp', 'asc')
  );
  const received = await assertSucceeds(getDocs(athleteMessages));
  assert.equal(received.size, 1);

  const athleteMessage = doc(athleteDb, 'coach-athlete-messages', messageId);
  await assertSucceeds(updateDoc(athleteMessage, {
    [`readBy.${athleteId}`]: serverTimestamp(),
  }));
  await assertFails(updateDoc(coachConversation, {
    [`unreadCount.${athleteId}`]: 0,
  }));
  await assertSucceeds(updateDoc(doc(
    athleteDb,
    'coach-athlete-conversations',
    conversationId
  ), {
    [`unreadCount.${athleteId}`]: 0,
  }));

  const athleteReplyId = 'message-athlete-reply-1';
  const athleteConversation = doc(
    athleteDb,
    'coach-athlete-conversations',
    conversationId
  );
  const athleteReply = doc(
    athleteDb,
    'coach-athlete-messages',
    athleteReplyId
  );
  const reply = writeBatch(athleteDb);
  reply.set(athleteReply, messageWrite({
    sender: athleteId,
    senderType: 'athlete',
    content: 'I will be ready, Coach.',
  }));
  reply.update(athleteConversation, {
    lastMessage: 'I will be ready, Coach.',
    lastMessageId: athleteReplyId,
    lastMessageSenderId: athleteId,
    lastMessageTimestamp: serverTimestamp(),
    unreadCount: {[coachId]: 1, [athleteId]: 0},
    updatedAt: serverTimestamp(),
  });
  await assertSucceeds(reply.commit());

  const coachMessages = query(
    collection(coachDb, 'coach-athlete-messages'),
    where('conversationId', '==', conversationId),
    orderBy('timestamp', 'asc')
  );
  const coachReceived = await assertSucceeds(getDocs(coachMessages));
  assert.equal(coachReceived.size, 2);
  await assertSucceeds(updateDoc(doc(
    coachDb,
    'coach-athlete-messages',
    athleteReplyId
  ), {
    [`readBy.${coachId}`]: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(coachConversation, {
    [`unreadCount.${coachId}`]: 0,
  }));
});

test('message and conversation summaries cannot be forged or written separately', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await seedConversation(context.firestore());
  });
  const db = testEnv.authenticatedContext(coachId).firestore();
  const conversation = doc(db, 'coach-athlete-conversations', conversationId);
  const orphanMessage = doc(db, 'coach-athlete-messages', 'orphan-message');
  await assertFails(setDoc(orphanMessage, messageWrite()));
  await assertFails(updateDoc(conversation, {
    lastMessage: 'No matching message',
    lastMessageId: 'missing-message',
    lastMessageSenderId: coachId,
    lastMessageTimestamp: serverTimestamp(),
    unreadCount: {[coachId]: 0, [athleteId]: 1},
    updatedAt: serverTimestamp(),
  }));

  const forged = writeBatch(db);
  forged.set(doc(db, 'coach-athlete-messages', 'forged-message'), messageWrite({
    content: 'Actual message',
  }));
  forged.update(conversation, {
    lastMessage: 'Different preview',
    lastMessageId: 'forged-message',
    lastMessageSenderId: coachId,
    lastMessageTimestamp: serverTimestamp(),
    unreadCount: {[coachId]: 0, [athleteId]: 1},
    updatedAt: serverTimestamp(),
  });
  await assertFails(forged.commit());
});

test('v2 registration is private, migrates legacy root fields, and transfers safely', async () => {
  const installationId = 'installation_1234567890';
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', coachId), {
      displayName: 'Coach Taylor',
      pulseCheckFcmToken: 'legacy-public-token',
      pulseCheckFcmTokenOwnerUserId: coachId,
      pulseCheckFcmTokenUpdatedAt: oldTimestamp,
      pushTokenSourceApp: 'pulsecheck',
    });
  });

  const coachDb = testEnv.authenticatedContext(coachId).firestore();
  const athleteDb = testEnv.authenticatedContext(athleteId).firestore();
  await assertSucceeds(registerInstallation(coachDb, {
    owner: coachId,
    installationId,
    token: 'coach-private-token',
  }));

  const publicProfile = await assertSucceeds(getDoc(doc(coachDb, 'users', coachId)));
  assert.equal(publicProfile.data().pulseCheckPushTokenModelVersion, 2);
  assert.equal('pulseCheckFcmToken' in publicProfile.data(), false);
  await assertFails(getDoc(doc(
    athleteDb,
    'users',
    coachId,
    'pulsecheckPushTokens',
    installationId
  )));

  await assertSucceeds(registerInstallation(athleteDb, {
    owner: athleteId,
    installationId,
    token: 'athlete-private-token',
  }));
  await assertFails(deleteDoc(doc(
    coachDb,
    'pulsecheck-push-installations',
    installationId
  )));
  await assertFails(getDoc(doc(
    coachDb,
    'pulsecheck-push-installations',
    installationId
  )));
});
