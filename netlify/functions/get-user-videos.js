const { admin } = require('./config/firebase');

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
