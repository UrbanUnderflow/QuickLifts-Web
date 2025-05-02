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

// Export all functions for Firebase to discover
exports.syncWorkoutSessionToRoot = syncWorkoutSessionToRoot;
exports.syncWorkoutSummaryToRoot = syncWorkoutSummaryToRoot;
exports.manualSyncWorkoutSessions = manualSyncWorkoutSessions;
exports.updateParticipantCounts = updateParticipantCounts;

// Add any other function exports from other files here if needed 