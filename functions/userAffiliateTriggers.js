const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Ensure admin is initialized (index.js already does this, but we guard here for safety in tests)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * onUserCreateGymAffiliate
 *
 * Trigger: Firestore document creation in `users/{userId}`.
 *
 * Behavior:
 * - If the new user document already contains a `gymAffiliateId` field (string doc ID of `gymAffiliates`),
 *   increment `memberSignupCount` on that gym affiliate using a Firestore atomic increment.
 * - Otherwise, if the user has a `gymInviteCode` field, resolve it to a `gymAffiliates` doc by inviteCode,
 *   write back `gymAffiliateId` onto the user, and then increment `memberSignupCount`.
 * - If neither field exists or the referenced/lookup document does not exist, no-op and log.
 */
exports.onUserCreateGymAffiliate = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    const userData = snap.data() || {};
    const { userId } = context.params;

    let gymAffiliateId = userData.gymAffiliateId;
    const gymInviteCode = userData.gymInviteCode;

    // First, try to resolve from gymInviteCode if gymAffiliateId is missing
    if (!gymAffiliateId && gymInviteCode) {
      console.log('[onUserCreateGymAffiliate] Resolving gymInviteCode for new user.', {
        userId,
        gymInviteCode,
      });

      try {
        const affiliatesRef = db.collection('gymAffiliates');
        const snapshot = await affiliatesRef.where('inviteCode', '==', gymInviteCode).limit(1).get();

        if (snapshot.empty) {
          console.warn('[onUserCreateGymAffiliate] No gymAffiliates match for inviteCode; skipping.', {
            userId,
            gymInviteCode,
          });
        } else {
          const affiliateDoc = snapshot.docs[0];
          gymAffiliateId = affiliateDoc.id;

          console.log('[onUserCreateGymAffiliate] Resolved inviteCode to gymAffiliateId. Updating user.', {
            userId,
            gymInviteCode,
            gymAffiliateId,
          });

          // Attach the resolved gymAffiliateId back to the user document for future reads.
          await snap.ref.update({ gymAffiliateId });
        }
      } catch (error) {
        console.error('[onUserCreateGymAffiliate] Error resolving gymInviteCode to affiliate:', {
          userId,
          gymInviteCode,
          error,
        });
        // Do not throw; we still want user creation to succeed.
      }
    }

    if (!gymAffiliateId) {
      console.log('[onUserCreateGymAffiliate] No gymAffiliateId on new user after resolution; skipping increment.', { userId });
      return null;
    }

    console.log('[onUserCreateGymAffiliate] New user with gym affiliate detected. Incrementing.', {
      userId,
      gymAffiliateId,
    });

    const gymAffiliateRef = db.collection('gymAffiliates').doc(gymAffiliateId);

    try {
      const docSnap = await gymAffiliateRef.get();
      if (!docSnap.exists) {
        console.warn('[onUserCreateGymAffiliate] gymAffiliates doc not found for gymAffiliateId; skipping increment.', {
          userId,
          gymAffiliateId,
        });
        return null;
      }

      await gymAffiliateRef.update({
        memberSignupCount: admin.firestore.FieldValue.increment(1),
      });

      console.log('[onUserCreateGymAffiliate] Incremented memberSignupCount for gym affiliate.', {
        userId,
        gymAffiliateId,
      });

      return null;
    } catch (error) {
      console.error('[onUserCreateGymAffiliate] Failed to increment memberSignupCount:', {
        userId,
        gymAffiliateId,
        error,
      });
      // Swallow error to avoid blocking user creation; alerts/logging can be added later
      return null;
    }
  });
