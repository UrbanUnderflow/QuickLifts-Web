const admin = require("firebase-admin");

// Initialize Firebase Admin SDK once
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Import functions from their respective files
const { syncWorkoutSessionToRoot } = require("./syncWorkoutSessions");

// Export all functions for Firebase to discover
exports.syncWorkoutSessionToRoot = syncWorkoutSessionToRoot;

// Add any other function exports from other files here if needed 