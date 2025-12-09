const { db, headers } = require('./config/firebase');

// Helper function to safely convert Firestore timestamps to ISO string dates
const convertTimestamp = (timestamp) => {
  if (!timestamp) return null;
  
  // Handle Firestore Timestamp objects with toDate method
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  
  // If it's a number (Unix timestamp), convert it
  if (typeof timestamp === 'number') {
    return new Date(timestamp * 1000).toISOString();
  }
  
  // Handle already converted date
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  
  return null;
};

async function getExerciseByName(name) {
  if (!name) {
    throw new Error('Exercise name is required');
  }

  try {
    // Preserve the original slug from the URL (kebab-case, possibly with %2D)
    const originalSlug = name;
    
    // First decode any URL-encoded hyphens (%2D) back to actual hyphens
    const decodedName = name.replace(/%2D/g, '-');
    
    // Then convert kebab-case to properly capitalized format
    // e.g., "bicep-curls" -> "Bicep Curls"
    const formattedName = decodedName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    console.log('Looking up exercise by name:', formattedName);

    // Try to get the exercise directly by ID/name
    const exerciseDoc = await db.collection('exercises').doc(formattedName).get();
    
    let exercise = null;
    
    // If the exercise exists, use it
    if (exerciseDoc.exists) {
      console.log('Found exercise directly by name');
      const exerciseData = exerciseDoc.data();
      const exerciseId = exerciseDoc.id;
      
      exercise = {
        id: exerciseId,
        name: exerciseData.name || formattedName,
        slug: (exerciseData.name || formattedName).toLowerCase().replace(/\s+/g, '-').replace(/-/g, '%2D'),
        description: exerciseData.description || '',
        category: exerciseData.category || {},
        primaryBodyParts: exerciseData.primaryBodyParts || [],
        secondaryBodyParts: exerciseData.secondaryBodyParts || [],
        tags: exerciseData.tags || [],
        steps: exerciseData.steps || [],
        visibility: exerciseData.visibility || 'private',
        currentVideoPosition: exerciseData.currentVideoPosition || 0,
        sets: exerciseData.sets || 0,
        reps: exerciseData.reps || '',
        weight: exerciseData.weight || 0,
        author: exerciseData.author || {},
        createdAt: convertTimestamp(exerciseData.createdAt),
        updatedAt: convertTimestamp(exerciseData.updatedAt)
      };
    } else {
      // If not found directly, try a query
      console.log('Exercise not found directly, trying query');
      const exercisesRef = db.collection('exercises');
      const snapshot = await exercisesRef.where('name', '==', formattedName).get();

      if (snapshot.empty) {
        // Try case-insensitive search and also slug-based matching (new + legacy)
        console.log('Exact match not found, trying case-insensitive and slug-based search');
        const allExercisesSnapshot = await exercisesRef.limit(200).get();
        
        let matchDoc = null;
        const candidateSlug = originalSlug.toLowerCase();

        allExercisesSnapshot.forEach(doc => {
          if (matchDoc) return;

          const data = doc.data();
          const exerciseName = data.name;
          if (!exerciseName) return;

          const normalizedName = exerciseName.toLowerCase();

          // 1) Case-insensitive name match
          if (normalizedName === formattedName.toLowerCase()) {
            matchDoc = doc;
            return;
          }

          // 2) New slug algorithm (encodes existing hyphens as %2D, then kebab-case)
          const newSlug = exerciseName
            .replace(/-/g, '%2D')
            .toLowerCase()
            .replace(/\s+/g, '-');

          // 3) Legacy slug algorithm (just kebab-case, leaves hyphens alone)
          const legacySlug = exerciseName
            .toLowerCase()
            .replace(/\s+/g, '-');

          if (candidateSlug === newSlug || candidateSlug === legacySlug) {
            matchDoc = doc;
          }
        });
        
        if (!matchDoc) {
          throw new Error('Exercise not found');
        }
        
        const exerciseData = matchDoc.data();
        const exerciseId = matchDoc.id;
        
        exercise = {
          id: exerciseId,
          name: exerciseData.name,
          slug: exerciseData.name.toLowerCase().replace(/\s+/g, '-').replace(/-/g, '%2D'),
          description: exerciseData.description || '',
          category: exerciseData.category || {},
          primaryBodyParts: exerciseData.primaryBodyParts || [],
          secondaryBodyParts: exerciseData.secondaryBodyParts || [],
          tags: exerciseData.tags || [],
          steps: exerciseData.steps || [],
          visibility: exerciseData.visibility || 'private',
          currentVideoPosition: exerciseData.currentVideoPosition || 0,
          sets: exerciseData.sets || 0,
          reps: exerciseData.reps || '',
          weight: exerciseData.weight || 0,
          author: exerciseData.author || {},
          createdAt: convertTimestamp(exerciseData.createdAt),
          updatedAt: convertTimestamp(exerciseData.updatedAt)
        };
      } else {
        const exerciseData = snapshot.docs[0].data();
        const exerciseId = snapshot.docs[0].id;

        exercise = {
          id: exerciseId,
          name: exerciseData.name,
          slug: exerciseData.name.toLowerCase().replace(/\s+/g, '-').replace(/-/g, '%2D'),
          description: exerciseData.description || '',
          category: exerciseData.category || {},
          primaryBodyParts: exerciseData.primaryBodyParts || [],
          secondaryBodyParts: exerciseData.secondaryBodyParts || [],
          tags: exerciseData.tags || [],
          steps: exerciseData.steps || [],
          visibility: exerciseData.visibility || 'private',
          currentVideoPosition: exerciseData.currentVideoPosition || 0,
          sets: exerciseData.sets || 0,
          reps: exerciseData.reps || '',
          weight: exerciseData.weight || 0,
          author: exerciseData.author || {},
          createdAt: convertTimestamp(exerciseData.createdAt),
          updatedAt: convertTimestamp(exerciseData.updatedAt)
        };
      }
    }

    // Fetch associated videos using both exerciseId and exercise name
    // This should match how your iOS app is querying videos
    const videosRef = db.collection('exerciseVideos');
    const videosSnapshot = await videosRef
      .where('exercise', '==', exercise.name)
      .get();

    // Map videos similar to your iOS implementation
    const videos = videosSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        exerciseId: data.exerciseId || '',
        username: data.username || '',
        userId: data.userId || '',
        videoURL: data.videoURL || '',
        fileName: data.fileName || '',
        exercise: data.exercise || '',
        profileImage: data.profileImage || {},
        caption: data.caption || '',
        gifURL: data.gifURL || '',
        thumbnail: data.thumbnail || '',
        visibility: data.visibility || 'private',
        isApproved: data.isApproved || false,
        createdAt: convertTimestamp(data.createdAt),
        updatedAt: convertTimestamp(data.updatedAt)
      };
    });

    // Add videos to the exercise object
    exercise.videos = videos;

    return exercise;
  } catch (error) {
    console.error('Error in getExerciseByName:', error);
    throw error;
  }
}

const handler = async (event) => {
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