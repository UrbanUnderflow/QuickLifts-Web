const { admin, db, headers } = require("./config/firebase"); // Assuming headers are for CORS

// Helper function to get the document ID for the current date (UTC-based)
const getTodaysDocumentId = () => {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const year = now.getUTCFullYear();
  return `${month}-${day}-${year}`;
};

// Core logic to select and save a move of the day (duplicated for now, consider shared util)
async function selectAndSaveMove() {
  console.log("[manualTriggerMoveOfTheDay] Executing core selectAndSaveMove logic.");
  const exercisesSnapshot = await db.collection("exercises").get();
  if (exercisesSnapshot.empty) {
    console.log("No exercises found.");
    throw new Error("No exercises available.");
  }
  const exercises = [];
  exercisesSnapshot.forEach((doc) => exercises.push({ firestoreDocId: doc.id, ...doc.data() }));
  
  const randomExercise = exercises[Math.floor(Math.random() * exercises.length)];
  const exerciseIdentifierForVideoLookup = randomExercise.id || randomExercise.firestoreDocId;
  if (!exerciseIdentifierForVideoLookup) {
    throw new Error("Selected exercise data is invalid.");
  }

  const videosSnapshot = await db.collection("exerciseVideos")
    .where("exerciseId", "==", exerciseIdentifierForVideoLookup).get();
  if (videosSnapshot.empty) {
    throw new Error(`No videos found for selected exercise: ${randomExercise.name}.`);
  }
  const videos = [];
  videosSnapshot.forEach((doc) => videos.push({ firestoreDocId: doc.id, ...doc.data() }));
  const randomVideo = videos[Math.floor(Math.random() * videos.length)];
  
  const documentId = getTodaysDocumentId();
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
  const moveOfTheDayData = {
    exercise: randomExercise,
    video: randomVideo,
    selectedDateISO: new Date().toISOString(),
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp,
  };
  await db.collection("moveOfTheDayCollection").doc(documentId).set(moveOfTheDayData, { merge: true });
  console.log(`[manualTriggerMoveOfTheDay] Saved Move of the Day for ${documentId}: ${randomExercise.name}.`);
  return { success: true, message: `Move of the Day for ${documentId} set to ${randomExercise.name}.`, exerciseName: randomExercise.name, documentId };
}

exports.handler = async (event, context) => {
  // Handle OPTIONS preflight request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405, 
      headers: { ...headers, Allow: 'POST' }, 
      body: JSON.stringify({ success: false, message: 'Method Not Allowed' })
    };
  }

  // Security: Verify Firebase ID token for admin access
  const authorizationHeader = event.headers.authorization;
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ success: false, message: 'Unauthorized: Missing or invalid Authorization header.' }),
    };
  }
  const idToken = authorizationHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    // Check for admin custom claim (ensure this claim is set for your admin users)
    if (decodedToken.admin !== true) {
      console.warn(`[manualTriggerMoveOfTheDay] Forbidden: User ${decodedToken.uid} is not an admin.`);
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ success: false, message: 'Forbidden: Admin privileges required.' }),
      };
    }
    console.log(`[manualTriggerMoveOfTheDay] Admin action initiated by: ${decodedToken.uid}`);
  } catch (error) {
    console.error("[manualTriggerMoveOfTheDay] Error verifying admin token:", error);
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ success: false, message: 'Unauthorized: Invalid token.', error: error.message }),
    };
  }
  // End Security Check

  if (!admin || !db || admin.apps.length === 0) {
    console.error("[manualTriggerMoveOfTheDay] Firebase Admin SDK not initialized or db not available from config.");
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: "Firebase Admin SDK setup error." }) };
  }

  console.log("[manualTriggerMoveOfTheDay] Netlify function triggered by admin.");
  try {
    const result = await selectAndSaveMove(); // Call the core logic
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: "Move of the Day manually set successfully.", details: result }),
    };
  } catch (error) {
    console.error("[manualTriggerMoveOfTheDay] Error:", error.message, error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message || "Internal server error." }),
    };
  }
}; 