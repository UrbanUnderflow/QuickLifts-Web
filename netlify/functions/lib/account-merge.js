const crypto = require('crypto');

const KEYED_DOCUMENT_COLLECTIONS = [
  'users',
  'subscriptions',
  'athlete-mental-progress',
  'personalBaselines',
  'biomarkerContext',
  'health-context-snapshots',
  'coach-nora-vault',
  'macro-profile',
  'macraInsights',
  'macraSuggestedMealPlans',
  'pulsecheck-user-revenue-summaries',
];

const USER_REFERENCE_COLLECTIONS = [
  'usernames',
  'pulsecheck-team-memberships',
  'pulsecheck-organization-memberships',
  'pulsecheck-pilot-enrollments',
  'pulsecheck-daily-assignments',
  'pulsecheck-assignment-events',
  'pulsecheck-athlete-calendar-events',
  'pulsecheck-morning-checkins',
  'pulsecheck-nora-conversations',
  'pulsecheck-coach-context-flags',
  'athlete-state-signal-alignments',
  'athlete-coach-connections',
  'coach-athlete-conversations',
  'check-ins',
  'checkins',
  'conversations',
  'messages',
  'notifications',
  'alerts',
  'escalation-records',
  'user-mental-notes',
  'mental-exercise-completions',
  'mental-exercise-assignments',
  'fitWithPulse-workoutSessions',
  'workoutSessions',
  'workout-summaries',
  'appleWatchWorkoutSummaries',
  'dailyActivity',
  'mealLogs',
  'bodyWeight',
  'payments',
  'payoutRecords',
  'transactions',
  'pulsecheck-revenue-events',
  'pulsecheck-team-revenue-summaries',
  'pulsecheck-coach-service-orders',
  'pulsecheck-assessment-purchases',
  'promoCodeUsage',
  'pulse-point-awards',
  'remoteLoginTokens',
  'one-on-one-trainings',
  'oneOnOneTrainings',
  'coaches',
  'clubMembers',
  'stripeConnect',
  'winnerStripeConnect',
  'creator-pages',
  'user-challenge',
  'userChallenges',
  'pulsecheck-teams',
  'pulsecheck-organizations',
];

const SCALAR_USER_FIELDS = [
  'userId',
  'uid',
  'athleteId',
  'coachId',
  'memberId',
  'ownerId',
  'createdBy',
  'recipientId',
  'senderId',
  'assignedTo',
  'firebaseUid',
  'appUserId',
  'legacyCoachId',
  'ownerUserId',
  'coachUserId',
  'subscriberUserId',
  'revenueRecipientUserId',
  'billingOwnerUserId',
  'commercialConfig.revenueRecipientUserId',
  'commercialConfig.billingOwnerUserId',
];

const ARRAY_USER_FIELDS = [
  'participantIds',
  'participants',
  'memberIds',
  'userIds',
  'athleteIds',
  'coachIds',
];

const REFERENCE_FIELDS_BY_COLLECTION = {
  'usernames': ['userId'],
  'pulsecheck-team-memberships': ['userId', 'legacyCoachId'],
  'pulsecheck-organization-memberships': ['userId'],
  'pulsecheck-pilot-enrollments': ['userId', 'athleteId'],
  'pulsecheck-daily-assignments': ['userId', 'athleteId'],
  'pulsecheck-assignment-events': ['userId', 'athleteId', 'coachId'],
  'pulsecheck-athlete-calendar-events': ['userId', 'athleteId', 'coachId'],
  'pulsecheck-morning-checkins': ['userId', 'athleteId'],
  'pulsecheck-nora-conversations': ['userId', 'athleteId', 'participantIds'],
  'pulsecheck-coach-context-flags': ['userId', 'coachId', 'athleteId'],
  'athlete-state-signal-alignments': ['userId', 'athleteId'],
  'athlete-coach-connections': ['userId', 'athleteId', 'coachId'],
  'coach-athlete-conversations': ['athleteId', 'coachId', 'coachUserId', 'participantIds'],
  'conversations': ['userId', 'ownerId', 'participantIds', 'participants'],
  'messages': ['userId', 'senderId', 'recipientId'],
  'notifications': ['userId', 'recipientId'],
  'alerts': ['userId', 'athleteId', 'coachId'],
  'escalation-records': ['userId', 'athleteId', 'coachId', 'assignedTo'],
  'payments': ['userId', 'firebaseUid', 'coachId', 'coachUserId', 'revenueRecipientUserId'],
  'payoutRecords': ['userId', 'coachId'],
  'transactions': [
    'userId',
    'firebaseUid',
    'coachId',
    'coachUserId',
    'revenueRecipientUserId',
    'billingOwnerUserId',
    'userIds',
  ],
  'pulsecheck-revenue-events': [
    'subscriberUserId',
    'revenueRecipientUserId',
    'billingOwnerUserId',
  ],
  'pulsecheck-team-revenue-summaries': [
    'revenueRecipientUserId',
    'billingOwnerUserId',
  ],
  'pulsecheck-coach-service-orders': [
    'coachUserId',
    'athleteUserId',
  ],
  'pulsecheck-assessment-purchases': [
    'coachUserId',
    'revenueRecipientUserId',
  ],
  'remoteLoginTokens': ['userId', 'uid'],
  'coaches': ['userId', 'uid'],
  'clubMembers': ['userId'],
  'stripeConnect': ['userId', 'uid'],
  'winnerStripeConnect': ['userId', 'uid'],
  'creator-pages': ['userId', 'ownerId'],
  'user-challenge': ['userId'],
  'userChallenges': ['userId'],
  'pulsecheck-teams': [
    'legacyCoachId',
    'ownerUserId',
    'createdBy',
    'commercialConfig.revenueRecipientUserId',
    'commercialConfig.billingOwnerUserId',
    'coachIds',
  ],
  'pulsecheck-organizations': ['ownerUserId', 'createdBy', 'legacyCoachId', 'memberIds'],
};

const timestamp = (admin) => admin.firestore.FieldValue.serverTimestamp();

const safeRecordId = (path) =>
  Buffer.from(path, 'utf8').toString('base64url').slice(0, 900);

const replaceUid = (value, sourceUid, canonicalUid) => {
  if (value === sourceUid) return canonicalUid;
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((entry) => (entry === sourceUid ? canonicalUid : entry))));
  }
  return value;
};

const getPathValue = (record, path) =>
  path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), record);

const setPathValue = (record, path, value) => {
  const keys = path.split('.');
  let cursor = record;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }
    cursor[key] = { ...(cursor[key] || {}) };
    cursor = cursor[key];
  });
};

const canonicalizeData = (data, sourceUid, canonicalUid) => {
  const next = { ...data };
  for (const field of [...SCALAR_USER_FIELDS, ...ARRAY_USER_FIELDS]) {
    const value = getPathValue(next, field);
    if (value !== undefined) {
      setPathValue(next, field, replaceUid(value, sourceUid, canonicalUid));
    }
  }
  if (next.id === sourceUid) next.id = canonicalUid;
  return next;
};

const mergeDataCanonicalWins = (source, canonical, sourceUid, canonicalUid) => ({
  ...canonicalizeData(source || {}, sourceUid, canonicalUid),
  ...(canonical || {}),
  mergedAccountUids: Array.from(new Set([
    ...((source && source.mergedAccountUids) || []),
    ...((canonical && canonical.mergedAccountUids) || []),
    sourceUid,
  ])),
});

const inspectKeyedDocuments = async (db, sourceUid, canonicalUid) => {
  const results = [];
  for (const collectionName of KEYED_DOCUMENT_COLLECTIONS) {
    const [source, canonical] = await Promise.all([
      db.collection(collectionName).doc(sourceUid).get(),
      db.collection(collectionName).doc(canonicalUid).get(),
    ]);
    if (source.exists) {
      results.push({
        kind: 'keyed-document',
        collection: collectionName,
        sourcePath: source.ref.path,
        destinationPath: canonical.ref.path,
        conflict: canonical.exists,
      });
    }
  }
  return results;
};

const inspectReferences = async (db, sourceUid) => {
  const byPath = new Map();

  for (const collectionName of USER_REFERENCE_COLLECTIONS) {
    const configuredFields = REFERENCE_FIELDS_BY_COLLECTION[collectionName] || ['userId'];
    for (const field of configuredFields.filter((field) => !ARRAY_USER_FIELDS.includes(field))) {
      try {
        const snapshot = await db.collection(collectionName).where(field, '==', sourceUid).get();
        snapshot.docs.forEach((doc) => {
          const current = byPath.get(doc.ref.path) || {
            kind: 'reference',
            collection: collectionName,
            sourcePath: doc.ref.path,
            fields: [],
          };
          current.fields.push(field);
          byPath.set(doc.ref.path, current);
        });
      } catch (error) {
        if (!String(error?.message || '').includes('index')) throw error;
      }
    }

    for (const field of configuredFields.filter((field) => ARRAY_USER_FIELDS.includes(field))) {
      try {
        const snapshot = await db.collection(collectionName).where(field, 'array-contains', sourceUid).get();
        snapshot.docs.forEach((doc) => {
          const current = byPath.get(doc.ref.path) || {
            kind: 'reference',
            collection: collectionName,
            sourcePath: doc.ref.path,
            fields: [],
          };
          current.fields.push(field);
          byPath.set(doc.ref.path, current);
        });
      } catch (error) {
        if (!String(error?.message || '').includes('index')) throw error;
      }
    }
  }

  return Array.from(byPath.values());
};

const inspectSubcollections = async (sourceRef, destinationRef, entries = []) => {
  const collections = await sourceRef.listCollections();
  for (const sourceCollection of collections) {
    const snapshot = await sourceCollection.get();
    for (const sourceDoc of snapshot.docs) {
      const destinationDoc = destinationRef.collection(sourceCollection.id).doc(sourceDoc.id);
      const destinationSnapshot = await destinationDoc.get();
      entries.push({
        kind: 'user-subcollection-document',
        collection: `users/*/${sourceCollection.id}`,
        sourcePath: sourceDoc.ref.path,
        destinationPath: destinationDoc.path,
        conflict: destinationSnapshot.exists,
      });
      await inspectSubcollections(sourceDoc.ref, destinationDoc, entries);
    }
  }
  return entries;
};

const buildMergePreview = async ({ db, auth, sourceUid, canonicalUid }) => {
  if (!sourceUid || !canonicalUid || sourceUid === canonicalUid) {
    throw new Error('Choose two different account IDs.');
  }

  const [sourceAuth, canonicalAuth, keyedDocuments, references] = await Promise.all([
    auth.getUser(sourceUid),
    auth.getUser(canonicalUid),
    inspectKeyedDocuments(db, sourceUid, canonicalUid),
    inspectReferences(db, sourceUid),
  ]);

  const subcollections = await inspectSubcollections(
    db.collection('users').doc(sourceUid),
    db.collection('users').doc(canonicalUid),
  );

  const entries = [...keyedDocuments, ...subcollections, ...references];
  return {
    source: {
      uid: sourceAuth.uid,
      email: sourceAuth.email || null,
      disabled: sourceAuth.disabled,
      providers: sourceAuth.providerData.map((provider) => provider.providerId),
    },
    canonical: {
      uid: canonicalAuth.uid,
      email: canonicalAuth.email || null,
      disabled: canonicalAuth.disabled,
      providers: canonicalAuth.providerData.map((provider) => provider.providerId),
    },
    counts: {
      total: entries.length,
      keyedDocuments: keyedDocuments.length,
      subcollectionDocuments: subcollections.length,
      references: references.length,
      conflicts: entries.filter((entry) => entry.conflict).length,
    },
    entries,
  };
};

const archiveDocument = async ({ auditRef, snapshot, admin }) => {
  const data = snapshot.exists ? snapshot.data() : null;
  const approximateBytes = Buffer.byteLength(JSON.stringify(data || {}));
  await auditRef.collection('records').doc(safeRecordId(snapshot.ref.path)).set({
    sourcePath: snapshot.ref.path,
    existed: snapshot.exists,
    data: snapshot.exists && approximateBytes < 700000 ? data : null,
    dataOmitted: snapshot.exists && approximateBytes >= 700000,
    approximateBytes,
    archivedAt: timestamp(admin),
  });
};

const copyDocumentTree = async ({
  sourceRef,
  destinationRef,
  sourceUid,
  canonicalUid,
  auditRef,
  admin,
  counters,
}) => {
  const [source, destination] = await Promise.all([sourceRef.get(), destinationRef.get()]);
  if (source.exists) {
    await archiveDocument({ auditRef, snapshot: source, admin });
    await archiveDocument({ auditRef, snapshot: destination, admin });
    const merged = mergeDataCanonicalWins(
      source.data(),
      destination.exists ? destination.data() : null,
      sourceUid,
      canonicalUid,
    );
    await destinationRef.set({
      ...merged,
      accountMergedAt: timestamp(admin),
      accountMergedFrom: sourceUid,
    }, { merge: true });
    counters.copied += 1;
  }

  const collections = await sourceRef.listCollections();
  for (const sourceCollection of collections) {
    const snapshot = await sourceCollection.get();
    for (const sourceChild of snapshot.docs) {
      const destinationChild = destinationRef.collection(sourceCollection.id).doc(sourceChild.id);
      await copyDocumentTree({
        sourceRef: sourceChild.ref,
        destinationRef: destinationChild,
        sourceUid,
        canonicalUid,
        auditRef,
        admin,
        counters,
      });
    }
  }

  if (source.exists) {
    await sourceRef.delete();
    counters.deleted += 1;
  }
};

const migrateReference = async ({
  db,
  reference,
  sourceUid,
  canonicalUid,
  auditRef,
  admin,
  counters,
}) => {
  const sourceRef = db.doc(reference.sourcePath);
  const source = await sourceRef.get();
  if (!source.exists) return;
  await archiveDocument({ auditRef, snapshot: source, admin });

  const nextData = canonicalizeData(source.data(), sourceUid, canonicalUid);
  const destinationPath = source.ref.path.includes(sourceUid)
    ? source.ref.path.split(sourceUid).join(canonicalUid)
    : source.ref.path;

  if (destinationPath === source.ref.path) {
    await source.ref.set({
      ...nextData,
      accountReferenceMergedAt: timestamp(admin),
      accountReferenceMergedFrom: sourceUid,
    }, { merge: true });
    counters.updated += 1;
    return;
  }

  const destinationRef = db.doc(destinationPath);
  const destination = await destinationRef.get();
  await archiveDocument({ auditRef, snapshot: destination, admin });
  await destinationRef.set({
    ...mergeDataCanonicalWins(
      nextData,
      destination.exists ? destination.data() : null,
      sourceUid,
      canonicalUid,
    ),
    accountReferenceMergedAt: timestamp(admin),
    accountReferenceMergedFrom: sourceUid,
  }, { merge: true });
  await source.ref.delete();
  counters.copied += 1;
  counters.deleted += 1;
};

const updateStripeCustomer = async ({ stripeCustomerId, canonicalUid, sourceUid }) => {
  if (!stripeCustomerId || !process.env.STRIPE_SECRET_KEY) {
    return { status: 'skipped', reason: stripeCustomerId ? 'stripe-key-unavailable' : 'customer-id-unavailable' };
  }

  const Stripe = require('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const customer = await stripe.customers.retrieve(stripeCustomerId);
  if (customer.deleted) return { status: 'skipped', reason: 'customer-deleted' };
  await stripe.customers.update(stripeCustomerId, {
    metadata: {
      ...(customer.metadata || {}),
      firebaseUid: canonicalUid,
      mergedFirebaseUid: sourceUid,
    },
  });
  return { status: 'updated', customerId: stripeCustomerId };
};

const transferRevenueCatCustomer = async ({ sourceCustomerIds, canonicalUid }) => {
  const apiKey = String(process.env.REVENUECAT_API_KEY_PULSECHECK || '').trim();
  const projectId = String(
    process.env.REVENUECAT_PROJECT_ID_PULSECHECK
    || process.env.REVENUECAT_PROJECT_ID
    || '',
  ).trim();
  if (!apiKey || !projectId) {
    return { status: 'skipped', reason: 'revenuecat-config-unavailable' };
  }

  const results = [];
  for (const sourceCustomerId of sourceCustomerIds) {
    if (!sourceCustomerId || sourceCustomerId === canonicalUid) continue;
    const response = await fetch(
      `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}`
        + `/customers/${encodeURIComponent(sourceCustomerId)}/actions/transfer`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_customer_id: canonicalUid }),
      },
    );
    if (response.status === 404) {
      results.push({ customerId: sourceCustomerId, status: 'not-found' });
      continue;
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`RevenueCat transfer failed (${response.status}): ${body.slice(0, 300)}`);
    }
    results.push({ customerId: sourceCustomerId, status: 'transferred' });
  }
  const transferred = results.filter((result) => result.status === 'transferred').length;
  return {
    status: transferred > 0 ? 'transferred' : 'skipped',
    reason: transferred > 0 ? null : 'source-customer-not-found',
    canonicalUid,
    results,
  };
};

const executeMerge = async ({
  db,
  auth,
  admin,
  sourceUid,
  canonicalUid,
  actor,
  deleteSourceAuth,
  providerId,
}) => {
  const preview = await buildMergePreview({ db, auth, sourceUid, canonicalUid });
  const mergeId = crypto.randomUUID();
  const auditRef = db.collection('account-merge-audits').doc(mergeId);
  const aliasRef = db.collection('account-aliases').doc(sourceUid);
  const [sourceSubscription, canonicalSubscription, sourceUserSnapshot] = await Promise.all([
    db.collection('subscriptions').doc(sourceUid).get(),
    db.collection('subscriptions').doc(canonicalUid).get(),
    db.collection('users').doc(sourceUid).get(),
  ]);
  const subscriptionForExternalIds = sourceSubscription.exists
    ? sourceSubscription.data()
    : canonicalSubscription.data();
  const stripeCustomerId =
    subscriptionForExternalIds?.stripeCustomerId
    || subscriptionForExternalIds?.customerId
    || null;
  const revenueCatSourceIds = Array.from(new Set([
    sourceUid,
    subscriptionForExternalIds?.rcAppUserId,
    ...(subscriptionForExternalIds?.rcAliases || []),
    ...(subscriptionForExternalIds?.revenueCatAppUserIds || []),
    ...(subscriptionForExternalIds?.accountAliases || []),
    sourceUserSnapshot.data()?.revenuecat?.appUserId,
    ...(sourceUserSnapshot.data()?.revenuecat?.aliases || []),
    ...(sourceUserSnapshot.data()?.revenueCatAppUserIds || []),
  ].map((value) => String(value || '').trim()).filter(Boolean)));
  const counters = { copied: 0, updated: 0, deleted: 0 };

  await db.runTransaction(async (transaction) => {
    const existingAlias = await transaction.get(aliasRef);
    if (existingAlias.exists && existingAlias.data()?.canonicalUid !== canonicalUid) {
      throw new Error('This source account is already assigned to another canonical account.');
    }
    if (existingAlias.exists && existingAlias.data()?.status === 'merging') {
      throw new Error('This account merge is already running.');
    }
    if (
      existingAlias.exists
      && existingAlias.data()?.status === 'data-merged'
      && actor?.type === 'admin'
    ) {
      throw new Error('This account data is already staged. The owner can finish linking from Settings.');
    }
    transaction.set(auditRef, {
      mergeId,
      sourceUid,
      canonicalUid,
      actor,
      providerId: providerId || null,
      status: 'running',
      preview,
      createdAt: timestamp(admin),
      updatedAt: timestamp(admin),
    });
    transaction.set(aliasRef, {
      sourceUid,
      canonicalUid,
      status: 'merging',
      providerId: providerId || null,
      mergeId,
      createdAt: timestamp(admin),
      updatedAt: timestamp(admin),
    }, { merge: true });
  });

  try {
    if (deleteSourceAuth) {
      await auth.updateUser(sourceUid, { disabled: true });
      await auditRef.set({
        sourceAuthDisabledAt: timestamp(admin),
        updatedAt: timestamp(admin),
      }, { merge: true });
    }

    for (const collectionName of KEYED_DOCUMENT_COLLECTIONS) {
      const sourceRef = db.collection(collectionName).doc(sourceUid);
      const destinationRef = db.collection(collectionName).doc(canonicalUid);
      if (collectionName === 'users') {
        await copyDocumentTree({
          sourceRef,
          destinationRef,
          sourceUid,
          canonicalUid,
          auditRef,
          admin,
          counters,
        });
        continue;
      }

      const source = await sourceRef.get();
      if (!source.exists) continue;
      const destination = await destinationRef.get();
      await archiveDocument({ auditRef, snapshot: source, admin });
      await archiveDocument({ auditRef, snapshot: destination, admin });
      await destinationRef.set({
        ...mergeDataCanonicalWins(
          source.data(),
          destination.exists ? destination.data() : null,
          sourceUid,
          canonicalUid,
        ),
        accountMergedAt: timestamp(admin),
        accountMergedFrom: sourceUid,
      }, { merge: true });
      await sourceRef.delete();
      counters.copied += 1;
      counters.deleted += 1;
    }

    const references = await inspectReferences(db, sourceUid);
    for (const reference of references) {
      await migrateReference({
        db,
        reference,
        sourceUid,
        canonicalUid,
        auditRef,
        admin,
        counters,
      });
    }

    const canonicalUserRef = db.collection('users').doc(canonicalUid);
    const canonicalSubscriptionRef = db.collection('subscriptions').doc(canonicalUid);
    await Promise.all([
      canonicalUserRef.set({
        accountAliases: admin.firestore.FieldValue.arrayUnion(sourceUid),
        revenueCatAppUserIds: admin.firestore.FieldValue.arrayUnion(sourceUid, canonicalUid),
        updatedAt: timestamp(admin),
      }, { merge: true }),
      canonicalSubscriptionRef.set({
        accountAliases: admin.firestore.FieldValue.arrayUnion(sourceUid),
        revenueCatAppUserIds: admin.firestore.FieldValue.arrayUnion(sourceUid, canonicalUid),
        updatedAt: timestamp(admin),
      }, { merge: true }),
    ]);

    let stripe = { status: 'pending-provider-link' };
    let revenueCat = { status: 'pending-provider-link' };
    if (deleteSourceAuth) {
      try {
        stripe = await updateStripeCustomer({ stripeCustomerId, canonicalUid, sourceUid });
      } catch (error) {
        stripe = { status: 'error', reason: error instanceof Error ? error.message : String(error) };
      }
      try {
        revenueCat = await transferRevenueCatCustomer({
          sourceCustomerIds: revenueCatSourceIds,
          canonicalUid,
        });
      } catch (error) {
        revenueCat = { status: 'error', reason: error instanceof Error ? error.message : String(error) };
      }
    }

    if (deleteSourceAuth) {
      await auth.deleteUser(sourceUid);
    }

    const status = deleteSourceAuth ? 'awaiting-provider-link' : 'data-merged';
    await Promise.all([
      aliasRef.set({
        status,
        updatedAt: timestamp(admin),
      }, { merge: true }),
      auditRef.set({
        status,
        counters,
        externalSystems: {
          stripe,
          revenueCat: {
            ...revenueCat,
            appUserIds: [canonicalUid, sourceUid],
          },
        },
        sourceAuthDeleted: Boolean(deleteSourceAuth),
        updatedAt: timestamp(admin),
        completedAt: timestamp(admin),
      }, { merge: true }),
    ]);

    return { mergeId, status, counters, preview, externalSystems: { stripe, revenueCat } };
  } catch (error) {
    if (deleteSourceAuth) {
      await auth.updateUser(sourceUid, { disabled: false }).catch(() => undefined);
    }
    await Promise.all([
      auditRef.set({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        updatedAt: timestamp(admin),
      }, { merge: true }),
      aliasRef.set({
        status: 'failed',
        updatedAt: timestamp(admin),
      }, { merge: true }),
    ]);
    throw error;
  }
};

const rollbackMerge = async ({ db, admin, mergeId, actor }) => {
  const auditRef = db.collection('account-merge-audits').doc(mergeId);
  const audit = await auditRef.get();
  if (!audit.exists) throw new Error('Account merge audit not found.');
  const auditData = audit.data() || {};
  if (auditData.sourceAuthDeleted) {
    throw new Error('This merge cannot be rolled back after the source sign-in was transferred.');
  }
  if (auditData.status !== 'data-merged') {
    throw new Error('Only a staged data merge can be rolled back.');
  }

  const records = await auditRef.collection('records').get();
  const omitted = records.docs.filter((entry) => entry.data()?.dataOmitted);
  if (omitted.length > 0) {
    throw new Error('Rollback requires support because one or more large records were archived separately.');
  }

  for (let index = 0; index < records.docs.length; index += 350) {
    const batch = db.batch();
    records.docs.slice(index, index + 350).forEach((entry) => {
      const record = entry.data() || {};
      const reference = db.doc(record.sourcePath);
      if (record.existed) {
        batch.set(reference, record.data || {});
      } else {
        batch.delete(reference);
      }
    });
    await batch.commit();
  }

  if (auditData.sourceUid) {
    await db.collection('account-aliases').doc(auditData.sourceUid).delete();
  }
  await auditRef.set({
    status: 'rolled-back',
    rolledBackBy: actor,
    rolledBackAt: timestamp(admin),
    updatedAt: timestamp(admin),
  }, { merge: true });
  return { mergeId, status: 'rolled-back', restoredRecords: records.size };
};

module.exports = {
  ARRAY_USER_FIELDS,
  KEYED_DOCUMENT_COLLECTIONS,
  REFERENCE_FIELDS_BY_COLLECTION,
  SCALAR_USER_FIELDS,
  USER_REFERENCE_COLLECTIONS,
  buildMergePreview,
  canonicalizeData,
  executeMerge,
  mergeDataCanonicalWins,
  rollbackMerge,
};
