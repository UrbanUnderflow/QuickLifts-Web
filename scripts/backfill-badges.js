const admin = require('firebase-admin');

// Initialize Firebase Admin with default credentials if available, or specify path to service account
// To run this locally, you might need GOOGLE_APPLICATION_CREDENTIALS set.
// Since you are in local dev, let's just initialize.
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
} catch (e) {
  admin.initializeApp();
}

const db = admin.firestore();

async function backfillBadges() {
  console.log('Starting badge backfill...');
  try {
    const collectionsSnap = await db.collection('sweatlist-collection')
      .where('challenge.status', '==', 'completed')
      .get();
      
    if (collectionsSnap.empty) {
      console.log('No completed rounds found.');
      return;
    }

    let roundsProcessed = 0;
    let badgesAwarded = 0;

    for (const doc of collectionsSnap.docs) {
      const data = doc.data();
      const challenge = data.challenge;
      if (!challenge) continue;

      const roundId = challenge.id || doc.id;
      const roundTitle = challenge.title || 'Round';
      
      const badgeCheck = await db.collection('round-badge-log').doc(roundId).get();
      if (badgeCheck.exists) {
        console.log(`Round ${roundId} already processed (log exists). Skipping.`);
        continue;
      }

      const participantsSnap = await db.collection('user-challenge')
        .where('challengeId', '==', roundId)
        .get();

      if (participantsSnap.empty) continue;

      const participants = [];
      for (const pDoc of participantsSnap.docs) {
        const p = pDoc.data();
        participants.push({
          userId: p.userId || '',
          username: p.username || p.displayName || 'user',
          totalPoints: p.pulsePoints ?? p.points ?? 0,
          completedWorkouts: p.completedWorkouts ?? 0
        });
      }

      participants.sort((a, b) => b.totalPoints - a.totalPoints);
      
      if (participants.length < 2) {
        await db.collection('round-badge-log').doc(roundId).set({
          roundId,
          processedAt: Math.floor(Date.now() / 1000),
          participantCount: participants.length,
          skipped: true,
          reason: 'fewer than 2 participants'
        });
        continue;
      }

      const top3 = participants.slice(0, 3);
      const roundType = challenge.challengeType || 'lift';
      const endDate = typeof challenge.endDate === 'number' ? challenge.endDate : Math.floor(Date.now() / 1000);
      const startDate = typeof challenge.startDate === 'number' ? challenge.startDate : endDate - 86400;
      const durationDays = Math.max(1, Math.round((endDate - startDate) / 86400));
      
      let hostUsername = 'host';
      const hostIds = Array.isArray(challenge.ownerId) ? challenge.ownerId : (challenge.ownerId ? [challenge.ownerId] : []);
      if (hostIds.length > 0) {
        try {
          const hostDoc = await db.collection('users').doc(hostIds[0]).get();
          if (hostDoc.exists) {
              hostUsername = hostDoc.data().username || 'host';
          }
        } catch(e) {}
      }

      const batch = db.batch();

      for (let i = 0; i < top3.length; i++) {
        const p = top3[i];
        if (!p.userId) continue;

        const rank = i + 1;
        const badgeId = `${roundId}-${rank}`;

        const badgeData = {
          id: badgeId,
          userId: p.userId,
          roundId,
          roundTitle,
          roundType,
          rank,
          totalPoints: p.totalPoints,
          participantCount: participants.length,
          completedWorkouts: p.completedWorkouts,
          awardedAt: endDate,
          roundStartDate: startDate,
          roundEndDate: endDate,
          hostUsername,
          durationDays,
        };

        const badgeRef = db.collection('users').doc(p.userId).collection('badges').doc(badgeId);
        batch.set(badgeRef, badgeData);
        badgesAwarded++;
      }

      batch.set(db.collection('round-badge-log').doc(roundId), {
        roundId,
        roundTitle,
        processedAt: Math.floor(Date.now() / 1000),
        participantCount: participants.length,
        top3: top3.map((p, i) => ({
          userId: p.userId,
          username: p.username,
          rank: i + 1,
          totalPoints: p.totalPoints
        })),
        isBackfill: true
      });

      await batch.commit();
      roundsProcessed++;
      console.log(`Processed backfill for round ${roundId}`);
    }

    console.log(`Backfill complete. Rounds: ${roundsProcessed}, Badges: ${badgesAwarded}`);
    process.exit(0);
  } catch(e) {
    console.error('Error during backfill: ', e);
    process.exit(1);
  }
}

backfillBadges();
