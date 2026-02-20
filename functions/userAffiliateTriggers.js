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
 * - If the new user document contains a `gymAffiliateId` field (string doc ID of `gymAffiliates`),
 *   increment `memberSignupCount` on that gym affiliate using a Firestore atomic increment.
 * - If `gymAffiliateId` is missing or the referenced document does not exist, no-op and log.
 */
exports.onUserCreateGymAffiliate = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    const userData = snap.data() || {};
    const { userId } = context.params;

    const gymAffiliateId = userData.gymAffiliateId;

    if (!gymAffiliateId) {
      console.log('[onUserCreateGymAffiliate] No gymAffiliateId on new user; skipping increment.', { userId });
      return null;
    }

    console.log('[onUserCreateGymAffiliate] New user with gym affiliate detected.', {
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
