// const admin = require("firebase-admin"); // This will be imported from config
const { admin, db, convertTimestamp } = require("./config/firebase"); // Use your shared config and added convertTimestamp

// Initialize Firebase Admin SDK - This section is now handled by your config/firebase.js
// if (admin.apps.length === 0) { ... existing initialization block ... }
// const db = admin.firestore(); // This is also from config

// Helper function to get the document ID for the current date
const getTodaysDocumentId = () => {
  const now = new Date(); // Represents the current moment in UTC in the Netlify environment
  // If convertTimestamp is intended to be a universal way to get a normalized JS Date:
  // const today = convertTimestamp(now); // This might be redundant if now is already a Date
  // For clarity, we'll use 'now' directly here as it's already a JS Date object.
  
  // This will use the UTC date components as Netlify functions run in UTC.
  // If a specific timezone (e.g., America/New_York) is needed to define the "day", 
  // this logic needs to be updated using a timezone library.
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const year = now.getUTCFullYear();
  return `${month}-${day}-${year}`;
};

// Core logic to select and save a move of the day
async function selectAndSaveMove() {
  console.log("Executing core selectAndSaveMove logic in Netlify function.");
  const exercisesSnapshot = await db.collection("exercises").get();

  if (exercisesSnapshot.empty) {
    console.log("No exercises found in the 'exercises' collection.");
    throw new Error("No exercises available to select for Move of the Day.");
  }

  const exercises = [];
  exercisesSnapshot.forEach((doc) => {
    exercises.push({ firestoreDocId: doc.id, ...doc.data() });
  });

  const randomExercise = exercises[Math.floor(Math.random() * exercises.length)];
  const exerciseIdentifierForVideoLookup = randomExercise.id || randomExercise.firestoreDocId;

  if (!exerciseIdentifierForVideoLookup) {
    console.error("Selected exercise is missing a usable 'id' or 'firestoreDocId' field.", randomExercise);
    throw new Error("Selected exercise data is invalid.");
  }

  const videosSnapshot = await db
    .collection("exerciseVideos") // Corrected from 'exercise-videos' based on your fix in MoveManagement.tsx
    .where("exerciseId", "==", exerciseIdentifierForVideoLookup)
    .get();

  if (videosSnapshot.empty) {
    console.warn(`No videos found for exercise: "${randomExercise.name}" (ID: ${exerciseIdentifierForVideoLookup}).`);
    // This could be enhanced to try another exercise, but for now, it will fail the run.
    throw new Error(`No videos found for selected exercise: ${randomExercise.name}.`);
  }

  const videos = [];
  videosSnapshot.forEach((doc) => videos.push({ firestoreDocId: doc.id, ...doc.data() }));
  const randomVideo = videos[Math.floor(Math.random() * videos.length)];
  const documentId = getTodaysDocumentId();
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp(); // Use actual server timestamp

  const moveOfTheDayData = {
    exercise: randomExercise,
    video: randomVideo,
    selectedDateISO: new Date().toISOString(), // Standard UTC ISO string, generally fine
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp, // Also set updatedAt
  };

  await db.collection("moveOfTheDay").doc(documentId).set(moveOfTheDayData, { merge: true });
  console.log(`Successfully saved Move of the Day for ${documentId}: Exercise "${randomExercise.name}".`);
  return { success: true, message: `Move of the Day for ${documentId} set to ${randomExercise.name}.`, exerciseName: randomExercise.name, documentId };
}

exports.handler = async (event) => {
  console.log("Netlify function 'scheduleMoveOfTheDay' triggered.");

  // Check if admin and db were successfully imported from config
  if (!admin || !db || admin.apps.length === 0) { // Simplified check, assuming config handles initialization errors
    console.error("Firebase Admin SDK not initialized or db not available from config. Exiting.");
    return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: "Firebase Admin SDK not initialized or not available from config." }),
    };
  }

  try {
    const documentId = getTodaysDocumentId();
    const existingDoc = await db.collection("moveOfTheDay").doc(documentId).get();

    if (existingDoc.exists) {
      console.log(`Move of the Day for ${documentId} already exists (likely set manually or by a previous run). Skipping scheduled selection.`);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: "Skipped: Move of the Day already set for " + documentId }),
      };
    }

    console.log(`No Move of the Day found for ${documentId}. Proceeding with selection.`);
    const result = await selectAndSaveMove();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Move of the Day selected and saved successfully.", details: result }),
    };
  } catch (error) {
    console.error("Error in scheduleMoveOfTheDay Netlify function:", error.message, error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message || "Internal server error." }),
    };
  }
}; 