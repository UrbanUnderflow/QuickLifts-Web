const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Ensure Firebase Admin is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// Helper function to get the document ID for the current date
// const getTodaysDocumentId = () => {
//   const today = new Date();
//   const month = String(today.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
//   const day = String(today.getDate()).padStart(2, "0");
//   const year = today.getFullYear();
//   return `${month}-${day}-${year}`;
// };

// Core logic to select and save a move of the day
async function selectAndSaveMove() {
  console.log("Executing core selectAndSaveMove logic.");
  // 1. Fetch all exercises
  const exercisesSnapshot = await db.collection("exercises").get();

  if (exercisesSnapshot.empty) {
    console.log("No exercises found in the 'exercises' collection.");
    throw new functions.https.HttpsError("not-found", "No exercises available.");
  }

  const exercises = [];
  exercisesSnapshot.forEach((doc) => {
    exercises.push({ firestoreDocId: doc.id, ...doc.data() });
  });
  console.log(`Fetched ${exercises.length} exercises.`);

  // 2. Select a random exercise
  const randomExercise = exercises[Math.floor(Math.random() * exercises.length)];
  const exerciseIdentifierForVideoLookup = randomExercise.id || randomExercise.firestoreDocId;

  if (!exerciseIdentifierForVideoLookup) {
    console.error("Selected exercise is missing a usable 'id' or 'firestoreDocId' field.", randomExercise);
    throw new functions.https.HttpsError("internal", "Selected exercise is invalid.");
  }
  console.log(`Selected random exercise: "${randomExercise.name}" (Document ID: ${exerciseIdentifierForVideoLookup})`);

  // 3. Fetch videos for the selected exercise
  const videosSnapshot = await db
    .collection("exercise-videos")
    .where("exerciseId", "==", exerciseIdentifierForVideoLookup)
    .get();

  if (videosSnapshot.empty) {
    console.warn(`No videos found for exercise: "${randomExercise.name}" (ID: ${exerciseIdentifierForVideoLookup}).`);
    // Attempt to find another exercise? For now, we'll throw an error for the manual trigger
    // and the scheduled one would try again next time or log an error if this becomes frequent.
    throw new functions.https.HttpsError("not-found", `No videos found for selected exercise: ${randomExercise.name}.`);
  }

  const videos = [];
  videosSnapshot.forEach((doc) => videos.push({ firestoreDocId: doc.id, ...doc.data() }));
  console.log(`Found ${videos.length} videos for the selected exercise.`);

  // 4. Select a random video
  const randomVideo = videos[Math.floor(Math.random() * videos.length)];
  console.log(`Selected random video (Document ID: ${randomVideo.firestoreDocId}) for exercise "${randomExercise.name}".`);

  // 5. Get current date for document ID (MM-DD-YYYY)
  const documentId = getTodaysDocumentId();
  const today = new Date(); // For selectedDateISO

  // 6. Prepare data to save
  const moveOfTheDayData = {
    exercise: randomExercise,
    video: randomVideo,
    selectedDateISO: today.toISOString(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // 7. Save to moveOfTheDayCollection
  await db.collection("moveOfTheDayCollection").doc(documentId).set(moveOfTheDayData, { merge: true }); // Use merge to overwrite if exists
  console.log(`Successfully saved Move of the Day for ${documentId}: Exercise "${randomExercise.name}", Video (Doc ID: ${randomVideo.firestoreDocId})`);
  return { success: true, message: `Move of the Day for ${documentId} set to ${randomExercise.name}.`, exerciseName: randomExercise.name, documentId };
}

/**
 * Scheduled function: Selects a "Move of the Day" randomly if one hasn't been set manually for the day.
 * THIS FUNCTION IS NOW DEPRECATED AND REPLACED BY netlify/functions/scheduleMoveOfTheDay.js
 */
// exports.selectMoveOfTheDay = functions.pubsub
//   .schedule("every day 00:00")
//   .timeZone("America/New_York")
//   .onRun(async (context) => {
//     try {
//       console.log("DEPRECATED Firebase scheduled selectMoveOfTheDay function execution START - SHOULD NOT RUN.");
//       const documentId = getTodaysDocumentId(); // This helper might need to be inside selectAndSaveMove or passed if that's sole user

//       const existingDoc = await db.collection("moveOfTheDayCollection").doc(documentId).get();
//       if (existingDoc.exists) {
//         console.log(`Move of the Day for ${documentId} already exists. Skipping scheduled selection.`);
//         return null;
//       }

//       console.log(`No Move of the Day found for ${documentId}. Proceeding with selection.`);
//       await selectAndSaveMove();
//       return null;

//     } catch (error) {
//       if (error instanceof functions.https.HttpsError) {
//         console.error(`DEPRECATED Firebase Scheduled selectMoveOfTheDay failed: ${error.code} - ${error.message}`);
//       } else {
//         console.error("Error in DEPRECATED Firebase scheduled selectMoveOfTheDay:", error);
//       }
//       return null;
//     }
//   });

/**
 * Callable function: Manually triggers the selection and saving of "Move of the Day".
 * THIS FUNCTION IS NOW DEPRECATED AND REPLACED BY netlify/functions/manualTriggerMoveOfTheDay.js
 */
// exports.manualTriggerMoveOfTheDay = functions.https.onCall(async (data, context) => {
//   console.log("DEPRECATED Firebase manualTriggerMoveOfTheDay was called.");
//   try {
//     // Optional: Add admin/auth check here if needed for callable functions
//     // if (!context.auth || !context.auth.token.admin) {
//     //   throw new functions.https.HttpsError('unauthenticated', 'The function must be called by an authenticated admin.');
//     // }
//     const result = await selectAndSaveMove(); // Call the core logic
//     return result; 
//   } catch (error) {
//     console.error("Error in DEPRECATED Firebase manualTriggerMoveOfTheDay:", error);
//     if (error instanceof functions.https.HttpsError) {
//         throw error; // Re-throw HttpsError as is
//     }
//     throw new functions.https.HttpsError("internal", "An unexpected error occurred while setting the Move of the Day.", error.message);
//   }
// }); 