const { db, headers } = require('./config/firebase');

async function getExerciseByName(name) {
  if (!name) {
    throw new Error('Exercise name is required');
  }

  try {
    const exercisesRef = db.collection('exercises');
    
    // First decode any URL-encoded hyphens (%2D) back to actual hyphens
    const decodedName = name.replace(/%2D/g, '-');
    
    // Then convert kebab-case to properly capitalized format
    // e.g., "bicep-curls" -> "Bicep Curls"
    const formattedName = decodedName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    console.log('Searching for exercise:', formattedName);

    const snapshot = await exercisesRef.where('name', '==', formattedName).get();

    if (snapshot.empty) {
      // If exact match isn't found, try a case-insensitive search
      console.log('Exact match not found, trying case-insensitive search');
      
      // Get all exercises (with a reasonable limit)
      const allExercisesSnapshot = await exercisesRef.limit(200).get();
      
      // Find a case-insensitive match
      let matchDoc = null;
      allExercisesSnapshot.forEach(doc => {
        const exerciseName = doc.data().name;
        if (exerciseName && exerciseName.toLowerCase() === formattedName.toLowerCase()) {
          matchDoc = doc;
        }
      });
      
      if (!matchDoc) {
        throw new Error('Exercise not found');
      }
      
      const exerciseData = matchDoc.data();
      const exerciseId = matchDoc.id;
      
      // Continue with fetching videos for this exercise...
      const videosRef = db.collection('exerciseVideos');
      const videosSnapshot = await videosRef
        .where('exerciseId', '==', exerciseId)
        .get();

      const videos = videosSnapshot.docs.map(doc => ({
        id: doc.id,
        exerciseId: doc.data().exerciseId || '',
        username: doc.data().username || '',
        userId: doc.data().userId || '',
        videoURL: doc.data().videoURL || '',
        fileName: doc.data().fileName || '',
        exercise: doc.data().exercise || '',
        profileImage: doc.data().profileImage || {},
        caption: doc.data().caption || '',
        gifURL: doc.data().gifURL || '',
        thumbnail: doc.data().thumbnail || '',
        visibility: doc.data().visibility || 'private',
        isApproved: doc.data().isApproved || false,
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));

      return {
        id: exerciseId,
        name: exerciseData.name,
        slug: exerciseData.name.toLowerCase().replace(/\s+/g, '-'),
        description: exerciseData.description || '',
        category: exerciseData.category || {},
        primaryBodyParts: exerciseData.primaryBodyParts || [],
        secondaryBodyParts: exerciseData.secondaryBodyParts || [],
        tags: exerciseData.tags || [],
        videos: videos,
        steps: exerciseData.steps || [],
        visibility: exerciseData.visibility || 'private',
        currentVideoPosition: exerciseData.currentVideoPosition || 0,
        sets: exerciseData.sets || 0,
        reps: exerciseData.reps || '',
        weight: exerciseData.weight || 0,
        author: exerciseData.author || {},
        createdAt: exerciseData.createdAt?.toDate(),
        updatedAt: exerciseData.updatedAt?.toDate()
      };
    }

    const exerciseData = snapshot.docs[0].data();
    const exerciseId = snapshot.docs[0].id;

    // Fetch associated videos
    const videosRef = db.collection('exerciseVideos');
    const videosSnapshot = await videosRef
      .where('exerciseId', '==', exerciseId)
      .get();

    const videos = videosSnapshot.docs.map(doc => ({
      id: doc.id,
      exerciseId: doc.data().exerciseId || '',
      username: doc.data().username || '',
      userId: doc.data().userId || '',
      videoURL: doc.data().videoURL || '',
      fileName: doc.data().fileName || '',
      exercise: doc.data().exercise || '',
      profileImage: doc.data().profileImage || {},
      caption: doc.data().caption || '',
      gifURL: doc.data().gifURL || '',
      thumbnail: doc.data().thumbnail || '',
      visibility: doc.data().visibility || 'private',
      isApproved: doc.data().isApproved || false,
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));

    return {
      id: exerciseId,
      name: exerciseData.name,
      slug: exerciseData.name.toLowerCase().replace(/\s+/g, '-'),
      description: exerciseData.description || '',
      category: exerciseData.category || {},
      primaryBodyParts: exerciseData.primaryBodyParts || [],
      secondaryBodyParts: exerciseData.secondaryBodyParts || [],
      tags: exerciseData.tags || [],
      videos: videos,
      steps: exerciseData.steps || [],
      visibility: exerciseData.visibility || 'private',
      currentVideoPosition: exerciseData.currentVideoPosition || 0,
      sets: exerciseData.sets || 0,
      reps: exerciseData.reps || '',
      weight: exerciseData.weight || 0,
      author: exerciseData.author || {},
      createdAt: exerciseData.createdAt?.toDate(),
      updatedAt: exerciseData.updatedAt?.toDate()
    };
  } catch (error) {
    throw error;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const name = event.queryStringParameters.name;
    
    if (!name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Exercise name parameter is required' 
        })
      };
    }

    const exercise = await getExerciseByName(name);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        exercise
      })
    };

  } catch (error) {
    console.error('Error fetching exercise:', error);
    
    return {
      statusCode: error.message === 'Exercise not found' ? 404 : 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

module.exports = { handler };