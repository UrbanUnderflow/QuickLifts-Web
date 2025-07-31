// Use v2 for Firestore triggers as recommended for newer projects
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { batchUpdateDocuments } = require("./utils/batchOperations");
const { hasAnyFieldChanged, getChangedFields, CHALLENGE_SYNC_FIELDS } = require("./utils/fieldComparison");

const db = admin.firestore();

/**
 * Builds the update data object for UserChallenge documents using only changed fields
 */
function buildChallengeUpdateData(updatedChallenge, changedFields) {
  const updateData = {};
  
  // Only update fields that actually changed
  Object.keys(changedFields).forEach(field => {
    if (updatedChallenge[field] !== undefined) {
      updateData[`challenge.${field}`] = updatedChallenge[field];
    }
  });

  // Always update the challenge's updatedAt timestamp
  updateData['challenge.updatedAt'] = admin.firestore.FieldValue.serverTimestamp();
  
  return updateData;
}

/**
 * Main Firebase Function: Sync Challenge updates to associated UserChallenges
 * Triggers on sweatlist-collection document updates using v2 syntax
 */
exports.syncChallengeToUserChallenges = onDocumentUpdated(
  'sweatlist-collection/{collectionId}',
  async (event) => {
    const change = event.data;
    const collectionId = event.params.collectionId;
    const logPrefix = `ChallengeSync-${collectionId}`;
    
    try {
      console.log(`[${logPrefix}] Processing Challenge update for collectionId: ${collectionId}`);
      
      // Extract challenge data from before/after states
      const beforeData = change.before.data();
      const afterData = change.after.data();
      
      const beforeChallenge = beforeData?.challenge;
      const afterChallenge = afterData?.challenge;

      // Early exit if no challenge object exists
      if (!afterChallenge) {
        console.log(`[${logPrefix}] No challenge object found in document, skipping sync`);
        return null;
      }

      // Check if any relevant fields changed using utility
      if (!hasAnyFieldChanged(beforeChallenge, afterChallenge, CHALLENGE_SYNC_FIELDS, logPrefix)) {
        console.log(`[${logPrefix}] No relevant challenge fields changed, skipping sync`);
        return null;
      }

      console.log(`[${logPrefix}] Relevant challenge fields changed, proceeding with UserChallenge sync`);

      // Get detailed information about what changed
      const changedFields = getChangedFields(beforeChallenge, afterChallenge, CHALLENGE_SYNC_FIELDS, logPrefix);
      const updateData = buildChallengeUpdateData(afterChallenge, changedFields);

      // Use batch utility to update all UserChallenge documents
      const queryParams = {
        field: 'challengeId',
        operator: '==',
        value: collectionId
      };

      const updatedCount = await batchUpdateDocuments(
        'user-challenge',
        queryParams,
        updateData,
        500,
        logPrefix
      );
      
      console.log(`[${logPrefix}] Successfully synced challenge updates to ${updatedCount} UserChallenge documents`);
      
      return {
        success: true,
        challengeId: collectionId,
        updatedCount: updatedCount,
        changedFields: Object.keys(changedFields),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`[${logPrefix}] Error syncing challenge to UserChallenges:`, error);
      
      // For v2 functions, we can just throw regular errors
      throw new Error(`Failed to sync challenge updates: ${error.message}`);
    }
  }); 