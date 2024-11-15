const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      "type": "service_account",
      "project_id": "quicklifts-dd3f1",
      "private_key_id": process.env.FIREBASE_PRIVATE_KEY,
      "private_key": process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
      "client_email": "firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
      "client_id": "111494077667496751062",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0%40quicklifts-dd3f1.iam.gserviceaccount.com",
      "universe_domain": "googleapis.com"
    })
  });
}

const db = admin.firestore();

async function getUserVideos(userId) {
  try {
    // Step 1: Get all user's exercise videos
    const exerciseVideosRef = db.collection('exerciseVideos');
    const videoSnapshot = await exerciseVideosRef
      .where('userId', '==', userId)
      .get();

    const videosByExerciseName = {};
    
    // Group videos by exercise name
    videoSnapshot.forEach(doc => {
      const videoData = doc.data();
      const exerciseName = videoData.exercise;
      
      if (!videosByExerciseName[exerciseName]) {
        videosByExerciseName[exerciseName] = [];
      }
      videosByExerciseName[exerciseName].push({
        id: doc.id,
        ...videoData
      });
    });

    // Step 2: Get all exercises from master list
    const exercisesRef = db.collection('exercises');
    const exercisesSnapshot = await exercisesRef.get();
    
    const exercises = [];
    
    exercisesSnapshot.forEach(doc => {
      const exerciseData = doc.data();
      if (videosByExerciseName[exerciseData.name]) {
        exercises.push({
          id: doc.id,
          ...exerciseData,
          videos: videosByExerciseName[exerciseData.name]
        });
      }
    });

    return exercises;
  } catch (error) {
    throw error;
  }
}

exports.handler = async (event) => {
  try {
    const userId = event.queryStringParameters.userId;
    
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'userId parameter is required' })
      };
    }

    const exercises = await getUserVideos(userId);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        exercises
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};