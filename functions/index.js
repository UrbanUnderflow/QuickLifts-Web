const admin = require("firebase-admin");

// Initialize Firebase Admin SDK once
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Import functions from their respective files
const { syncWorkoutSessionToRoot } = require("./syncWorkoutSessions");
const { syncWorkoutSummaryToRoot } = require("./syncWorkoutSummaries");
const { manualSyncWorkoutSessions } = require("./manualSync");
const { updateParticipantCounts } = require("./updateParticipantCounts");
// Import the new thumbnail functions
const { generateThumbnailOnWrite, generateMissingThumbnails, processThumbnailQueue } = require("./thumbnailGenerator");

// Export all functions for Firebase to discover
exports.syncWorkoutSessionToRoot = syncWorkoutSessionToRoot;
exports.syncWorkoutSummaryToRoot = syncWorkoutSummaryToRoot;
exports.manualSyncWorkoutSessions = manualSyncWorkoutSessions;
exports.updateParticipantCounts = updateParticipantCounts;

// Add any other function exports from other files here if needed
exports.sendNewUserJoinedChallengeNotification = require("./challengeNotifications").sendNewUserJoinedChallengeNotification;
exports.onChallengeStatusChange = require("./challengeNotifications").onChallengeStatusChange;
exports.sendWorkoutStartNotification = require("./challengeNotifications").sendWorkoutStartNotification;
exports.sendDirectMessageNotification = require("./directMessageNotifications").sendDirectMessageNotification;

// Export the new single notification function
exports.sendSingleNotification = require("./sendSingleNotification").sendSingleNotification; 

// Export the new thumbnail functions
exports.generateThumbnailOnWrite = generateThumbnailOnWrite;
exports.generateMissingThumbnails = generateMissingThumbnails; 
exports.processThumbnailQueue = processThumbnailQueue; 