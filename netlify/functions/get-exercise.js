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

async function getExerciseByName(name) {
  if (!name) {
    throw new Error('Exercise name is required');
  }

  try {
    const exercisesRef = db.collection('exercises');
    
    // Convert hyphens to spaces and capitalize each word
    const formattedName = name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    console.log('Searching for exercise:', formattedName); // Add logging

    const snapshot = await exercisesRef.where('name', '==', formattedName).get();

    if (snapshot.empty) {
      throw new Error('Exercise not found');
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
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

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
        body: JSON.stringify({ 
          success: false, 
          error: 'Exercise name parameter is required' 
        })
      };
    }

    const exercise = await getExerciseByName(name);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        exercise
      })
    };

  } catch (error) {
    console.error('Error fetching exercise:', error);
    
    return {
      statusCode: error.message === 'Exercise not found' ? 404 : 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};