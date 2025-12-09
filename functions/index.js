const admin = require("firebase-admin");

// Initialize Firebase Admin SDK once
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Import functions from their respective files
const { syncWorkoutSessionToRoot } = require("./syncWorkoutSessions");
const { syncWorkoutSummaryToRoot } = require("./syncWorkoutSummaries");
const { syncMealLogToRoot } = require("./syncMealLogs");
const { syncStackToRoot } = require("./syncStacks");
const { manualSyncWorkoutSessions } = require("./manualSync");
const { manualSyncMealLogs } = require("./manualSyncMealLogs");
const { updateParticipantCounts } = require("./updateParticipantCounts");
// Import the new thumbnail / media functions
const {
  generateThumbnailOnWrite,
  generateMissingThumbnails,
  processThumbnailQueue,
  generateGifForExerciseVideo,
  generateGifForExerciseVideoHttp,
  normalizeExerciseVideoToMp4,
} = require("./thumbnailGenerator");
// Import the Move of the Day function
const { selectMoveOfTheDay } = require("./moveOfTheDay");

// Export all functions for Firebase to discover
exports.syncWorkoutSessionToRoot = syncWorkoutSessionToRoot;
exports.syncWorkoutSummaryToRoot = syncWorkoutSummaryToRoot;
exports.syncMealLogToRoot = syncMealLogToRoot;
exports.syncStackToRoot = syncStackToRoot;
exports.manualSyncWorkoutSessions = manualSyncWorkoutSessions;
exports.manualSyncMealLogs = manualSyncMealLogs;
exports.updateParticipantCounts = updateParticipantCounts;

// Add any other function exports from other files here if needed
exports.sendNewUserJoinedChallengeNotification = require("./challengeNotifications").sendNewUserJoinedChallengeNotification;
exports.onChallengeStatusChange = require("./challengeNotifications").onChallengeStatusChange;
exports.sendWorkoutStartNotification = require("./challengeNotifications").sendWorkoutStartNotification;
exports.onMainChallengeStatusChange = require("./challengeNotifications").onMainChallengeStatusChange;
exports.sendDirectMessageNotification = require("./directMessageNotifications").sendDirectMessageNotification;

// Export the new single notification function
exports.sendSingleNotification = require("./sendSingleNotification").sendSingleNotification; 

// Export the new thumbnail / media functions
exports.generateThumbnailOnWrite = generateThumbnailOnWrite;
exports.generateMissingThumbnails = generateMissingThumbnails; 
exports.processThumbnailQueue = processThumbnailQueue; 
exports.generateGifForExerciseVideo = generateGifForExerciseVideo;
exports.generateGifForExerciseVideoHttp = generateGifForExerciseVideoHttp;
exports.normalizeExerciseVideoToMp4 = normalizeExerciseVideoToMp4;

// Export the Move of the Day function - THIS IS NOW DEPRECATED
// exports.selectMoveOfTheDay = selectMoveOfTheDay;

// Export the new manual trigger Move of the Day function
exports.manualTriggerMoveOfTheDay = require("./moveOfTheDay").manualTriggerMoveOfTheDay; 

// Export the new check-in callout notification function
exports.sendCheckinCalloutNotification = require("./challengeNotifications").sendCheckinCalloutNotification; 

// Export the referral bonus functions
exports.handleReferralBonus = require("./challengeNotifications").handleReferralBonus;

// Export the new Chain Reaction notification function
exports.sendChainReactionNotification = require("./challengeNotifications").sendChainReactionNotification;

// Export the new chat notification functions
exports.sendDirectMessageNotification = require("./chatNotifications").sendDirectMessageNotification;
exports.sendRoundTableNotification = require("./chatNotifications").sendRoundTableNotification;
exports.sendRoundTableNotificationAlt = require("./chatNotifications").sendRoundTableNotificationAlt;

// Export the new batch workout fetch function, now directly from its v2 definition
// The function is defined and exported in getWorkoutsBatch.js using the v2 onCall method.
// We just need to re-export it here for Firebase to discover.
exports.getWorkoutsBatch = require("./getWorkoutsBatch").getWorkoutsBatch; 

// Export notification logger functions for debugging and monitoring
exports.logNotification = require("./notificationLogger").logNotification;
exports.logMulticastNotification = require("./notificationLogger").logMulticastNotification; 

// Export the Challenge sync function
exports.syncChallengeToUserChallenges = require("./syncChallengeToUserChallenges").syncChallengeToUserChallenges; 