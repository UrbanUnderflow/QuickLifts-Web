/**
 * cycleRollover.js
 *
 * Evergreen Challenge — Cycle Rollover Cron
 *
 * Runs hourly. For every evergreen challenge whose currently-active Cycle has
 * passed its endDate, performs an atomic rollover:
 *
 *   1. Rank participants of the expired Cycle by current-Cycle pulsePoints.
 *   2. Mark the expired Cycle `.completed` and snapshot the Cycle Champion.
 *   3. For each participant:
 *        - challengeLifetimePoints += pulsePoints.totalPoints
 *        - ClubMember.totalPoints  += pulsePoints.totalPoints (flows to club board)
 *        - pulsePoints reset to zero
 *        - if winner: cycleChampionshipsWon++, championedCycleIds.push(cycleId)
 *   4. Create the next ChallengeCycle doc (cycleNumber + 1, fresh start/end dates).
 *   5. Update the Challenge doc: currentCycleId, currentCycleEndsAt,
 *      completedCycleCount++.
 *
 * Firestore paths (all additive — nothing is deleted):
 *   sweatlist-collection/{collectionId}                        — Challenge doc
 *   sweatlist-collection/{collectionId}/cycles/{cycleId}       — ChallengeCycle docs
 *   sweatlist-collection/{collectionId}/user-challenge/{ucId}  — UserChallenge docs
 *   clubMembers/{clubId}_{userId}                              — ClubMember docs
 *
 * Scheduling: every hour is a reasonable default — Cycle boundaries are at most
 * day-of-week precision so an hour of drift is fine. Move to "every 10 minutes"
 * if we ever need tighter precision for same-day Cycles.
 */

const { getFirestore } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Sum all PulsePoints sub-buckets. Mirrors iOS `PulsePoints.totalPoints`. */
function sumPulsePoints(pp) {
    if (!pp || typeof pp !== "object") return 0;
    const stackTotals =
        (pp.baseCompletion || 0) +
        (pp.firstCompletion || 0) +
        (pp.streakBonus || 0) +
        (pp.checkInBonus || 0) +
        (pp.effortRating || 0) +
        (pp.mealTrackingBonus || 0) +
        (pp.stepPoints || 0);
    const communityTotals =
        (pp.chatParticipation || 0) +
        (pp.locationCheckin || 0) +
        (pp.contentEngagement || 0) +
        (pp.encouragementSent || 0) +
        (pp.encouragementReceived || 0) +
        (pp.cumulativeStreakBonus || 0) +
        (pp.shareBonus || 0) +
        (pp.referralBonus || 0) +
        (pp.peerChallengeBonus || 0) +
        (pp.physicalCheckInBonus || 0);
    return stackTotals + communityTotals;
}

/** Empty PulsePoints dictionary — reset value for rollover. */
function zeroedPulsePoints() {
    return {
        baseCompletion: 0,
        firstCompletion: 0,
        streakBonus: 0,
        checkInBonus: 0,
        effortRating: 0,
        mealTrackingBonus: 0,
        stepPoints: 0,
        chatParticipation: 0,
        locationCheckin: 0,
        contentEngagement: 0,
        encouragementSent: 0,
        encouragementReceived: 0,
        cumulativeStreakBonus: 0,
        shareBonus: 0,
        referralBonus: 0,
        peerChallengeBonus: 0,
        physicalCheckInBonus: 0,
    };
}

/** Resolve the effective Cycle length in days, honoring .custom override. */
function effectiveCycleDays(challenge) {
    const duration = challenge.cycleDuration || "weekly";
    if (duration === "custom" && Number.isFinite(challenge.customCycleDays) && challenge.customCycleDays > 0) {
        return challenge.customCycleDays;
    }
    switch (duration) {
        case "biweekly": return 14;
        case "thirtyDays": return 30;
        case "weekly":
        default: return 7;
    }
}

/** Build the next Cycle's endDate. For weekly/biweekly we snap to the club
 *  timezone's day-of-week (matches the design note: "fixed day-of-week in
 *  the club's timezone"). For thirtyDays / custom we just add the day count.
 *
 *  NOTE: clubTimezone-aware snapping is left as a TODO here — we default to
 *  a simple `startDate + N days` rollover until the Club doc stores timezone.
 *  When that's added, replace this function with a timezone-aware variant.
 */
function computeNextCycleEnd(startDate, cycleDays) {
    const end = new Date(startDate.getTime());
    end.setUTCDate(end.getUTCDate() + cycleDays);
    return end;
}

// ── Main rollover ───────────────────────────────────────────────────────────

/**
 * Rolls over one challenge. Called per-challenge from the scheduler.
 * Returns true if a rollover happened, false if the Cycle wasn't due yet.
 */
async function rolloverChallenge(db, collectionId, challenge) {
    if (!challenge.isEvergreen) return false;
    if (!challenge.currentCycleId) {
        console.log(`[cycleRollover] ${challenge.id} is evergreen but has no currentCycleId; skipping.`);
        return false;
    }

    const cycleRef = db
        .collection("sweatlist-collection")
        .doc(collectionId)
        .collection("cycles")
        .doc(challenge.currentCycleId);

    const cycleSnap = await cycleRef.get();
    if (!cycleSnap.exists) {
        console.warn(`[cycleRollover] ${challenge.id} currentCycleId=${challenge.currentCycleId} not found.`);
        return false;
    }
    const cycle = cycleSnap.data();

    const endTs = cycle.endDate || 0;
    const endMs = endTs * 1000; // Firestore stores timeIntervalSince1970 seconds
    if (Date.now() < endMs) {
        return false; // not due yet
    }

    // ── Fetch participants (UserChallenge docs) ────────────────────────────
    const participantsSnap = await db
        .collection("sweatlist-collection")
        .doc(collectionId)
        .collection("user-challenge")
        .where("challengeId", "==", challenge.id)
        .get();

    const participants = participantsSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));

    // Rank by current-Cycle pulsePoints.
    const ranked = participants
        .map(p => ({
            ref: p.ref,
            data: p.data,
            cyclePoints: sumPulsePoints(p.data.pulsePoints),
        }))
        .sort((a, b) => b.cyclePoints - a.cyclePoints);

    const champion = ranked.length > 0 && ranked[0].cyclePoints > 0 ? ranked[0] : null;

    const now = new Date();
    // Default autoRepeat to true for pre-existing docs (matches iOS default).
    const autoRepeat = challenge.autoRepeatCycles !== false;

    const batch = db.batch();

    // 1. Close the expired Cycle.
    const completedPayload = {
        status: "completed",
        completedAt: Math.floor(now.getTime() / 1000),
        participantCount: participants.length,
        championPoints: champion ? champion.cyclePoints : 0,
    };
    if (champion) {
        completedPayload.championUserId = champion.data.userId || null;
        completedPayload.championUsername = champion.data.username || null;
        completedPayload.championProfileImageURL =
            (champion.data.profileImage && champion.data.profileImage.profileImageURL) || null;
    }
    batch.set(cycleRef, completedPayload, { merge: true });

    // 2. If auto-repeat: create the next Cycle. If not: skip — the challenge
    //    completes after this Cycle (one-time cycled mode).
    let nextCycleId = null;
    let nextEnd = null;
    if (autoRepeat) {
        const nextCycleDays = effectiveCycleDays(challenge);
        const nextStart = now;
        nextEnd = computeNextCycleEnd(nextStart, nextCycleDays);
        nextCycleId = db.collection("_").doc().id;
        const nextCycleNumber = (cycle.cycleNumber || 1) + 1;

        const nextCycleRef = db
            .collection("sweatlist-collection")
            .doc(collectionId)
            .collection("cycles")
            .doc(nextCycleId);

        batch.set(nextCycleRef, {
            id: nextCycleId,
            challengeId: challenge.id,
            collectionId: collectionId,
            cycleNumber: nextCycleNumber,
            startDate: Math.floor(nextStart.getTime() / 1000),
            endDate: Math.floor(nextEnd.getTime() / 1000),
            status: "active",
            championPoints: 0,
            participantCount: participants.length,
            createdAt: Math.floor(now.getTime() / 1000),
        });
    }

    // 3. Update participants: lifetime += cyclePoints, reset pulsePoints,
    //    stamp new currentCycleId (or clear it if one-time), crown champion.
    for (const p of ranked) {
        const isChampion = !!(champion && p.ref.path === champion.ref.path);
        const updates = {
            pulsePoints: zeroedPulsePoints(),
            challengeLifetimePoints: (p.data.challengeLifetimePoints || 0) + p.cyclePoints,
            currentCycleId: nextCycleId, // null when one-time — signals "challenge done"
            updatedAt: Math.floor(now.getTime() / 1000),
        };
        if (isChampion) {
            updates.cycleChampionshipsWon = (p.data.cycleChampionshipsWon || 0) + 1;
            const championed = Array.isArray(p.data.championedCycleIds) ? p.data.championedCycleIds.slice() : [];
            championed.push(cycleSnap.id);
            updates.championedCycleIds = championed;
        }
        batch.set(p.ref, updates, { merge: true });
    }

    // 4. Update the Challenge doc — either advance to next Cycle, or complete.
    const challengeRef = db.collection("sweatlist-collection").doc(collectionId);
    if (autoRepeat) {
        batch.set(challengeRef, {
            currentCycleId: nextCycleId,
            currentCycleEndsAt: Math.floor(nextEnd.getTime() / 1000),
            completedCycleCount: (challenge.completedCycleCount || 0) + 1,
            updatedAt: Math.floor(now.getTime() / 1000),
        }, { merge: true });
    } else {
        // One-time: mark the challenge completed so the scheduler stops picking
        // it up on future runs. Keep isEvergreen=true so the UI still renders
        // the Cycle history + champion info.
        batch.set(challengeRef, {
            currentCycleId: null,
            currentCycleEndsAt: null,
            completedCycleCount: (challenge.completedCycleCount || 0) + 1,
            status: "completed",
            endDate: Math.floor(now.getTime() / 1000),
            updatedAt: Math.floor(now.getTime() / 1000),
        }, { merge: true });
    }

    // 5. Flow Cycle points into the club leaderboard (ClubMember.totalPoints).
    //    We look up the associated club via the challenge's ownerId array.
    //    If ownerId is a creator/club owner, we credit their ClubMember docs.
    //    NOTE: the mapping from challenge → clubId may vary by deployment.
    //    Adjust this block once the Pod/Club linkage is finalized.
    const ownerIds = Array.isArray(challenge.ownerId) ? challenge.ownerId : [];
    if (ownerIds.length > 0) {
        // For each participant, bump clubMembers/{clubId}_{userId}.totalPoints
        // for every club this challenge is linked to.
        for (const p of ranked) {
            if (!p.cyclePoints) continue;
            const userId = p.data.userId;
            if (!userId) continue;
            for (const clubId of ownerIds) {
                const cmRef = db.collection("clubMembers").doc(`${clubId}_${userId}`);
                batch.set(cmRef, {
                    totalPoints: require("firebase-admin").firestore.FieldValue.increment(p.cyclePoints),
                    updatedAt: Math.floor(now.getTime() / 1000),
                }, { merge: true });
            }
        }
    }

    await batch.commit();
    if (autoRepeat) {
        console.log(`[cycleRollover] Rolled over challenge ${challenge.id} — Cycle #${cycle.cycleNumber} → #${(cycle.cycleNumber || 1) + 1}. Champion: ${champion ? champion.data.username : "none"}.`);
    } else {
        console.log(`[cycleRollover] Completed one-time challenge ${challenge.id} — Cycle #${cycle.cycleNumber} finished. Champion: ${champion ? champion.data.username : "none"}.`);
    }
    return true;
}

// ── Scheduler entrypoint ────────────────────────────────────────────────────

exports.rolloverChallengeCycles = onSchedule("every 60 minutes", async () => {
    const db = getFirestore();

    console.log("[cycleRollover] Scanning for evergreen challenges due for rollover...");

    // Evergreen challenges live at `sweatlist-collection/{id}` with
    // `isEvergreen: true`. Fetch only those due (currentCycleEndsAt <= now).
    const nowSecs = Math.floor(Date.now() / 1000);
    const snap = await db.collection("sweatlist-collection")
        .where("isEvergreen", "==", true)
        .where("currentCycleEndsAt", "<=", nowSecs)
        .get();

    if (snap.empty) {
        console.log("[cycleRollover] No due challenges. Done.");
        return;
    }

    console.log(`[cycleRollover] ${snap.size} evergreen challenge(s) due for rollover.`);

    let succeeded = 0;
    let failed = 0;
    for (const doc of snap.docs) {
        const challenge = doc.data();
        challenge.id = challenge.id || doc.id;
        try {
            const rolled = await rolloverChallenge(db, doc.id, challenge);
            if (rolled) succeeded++;
        } catch (err) {
            failed++;
            console.error(`[cycleRollover] Failed for challenge ${doc.id}:`, err);
        }
    }

    console.log(`[cycleRollover] Done. Succeeded: ${succeeded}, failed: ${failed}.`);
});

// Export the inner helper too — makes it possible to invoke via an HTTP
// trigger or manual admin tool without duplicating logic. Wire up later
// once we have a manual "Force rollover" admin button.
exports._rolloverChallenge = rolloverChallenge;
