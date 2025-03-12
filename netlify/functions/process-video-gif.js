// Log the environment at the very beginning to help with debugging
console.log('==== Function Starting ====');
console.log('Environment variables:', {
  NODE_ENV: process.env.NODE_ENV,
  NETLIFY: process.env.NETLIFY,
  NETLIFY_DEV: process.env.NETLIFY_DEV,
  CONTEXT: process.env.CONTEXT
});

const admin = require('firebase-admin');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Check if we're running in a local development environment
// More robust detection by using multiple environment variables
const isLocalDev = 
  process.env.NETLIFY_DEV === 'true' || 
  !process.env.NETLIFY ||
  process.env.NODE_ENV === 'development' ||
  process.env.CONTEXT === 'dev';

console.log(`Detected environment: ${isLocalDev ? 'Local Development' : 'Production'}`);

let gifsiclePath = 'gifsicle'; // Default fallback

// Only try to require gifsicle when not in local development
if (!isLocalDev) {
  try {
    // Conditionally require gifsicle only in production
    const gifsicleModule = require('gifsicle');
    gifsiclePath = gifsicleModule.path || 'gifsicle';
    console.log('Successfully loaded gifsicle module');
  } catch (error) {
    console.warn('Could not load gifsicle module:', error.message);
    // Continue without gifsicle
  }
}

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  try {
    // Check for required environment variables
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_SECRET_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_STORAGE_BUCKET'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error(`Missing required Firebase environment variables: ${missingVars.join(', ')}`);
      
      if (!isLocalDev) {
        // In production, we must fail if environment variables are missing
        throw new Error('Firebase credentials not properly configured');
      } else {
        console.warn('Running in local dev mode without Firebase credentials - some functionality will be limited');
      }
    }
    
    // Only initialize Firebase if we have the required environment variables
    if (missingVars.length === 0) {
      // Initialize with environment variables - no fallbacks or mock values
      admin.initializeApp({
        credential: admin.credential.cert({
          "type": "service_account",
          "project_id": process.env.FIREBASE_PROJECT_ID,
          "private_key_id": process.env.FIREBASE_PRIVATE_KEY,
          "private_key": process.env.FIREBASE_SECRET_KEY.replace(/\\n/g, '\n'),
          "client_email": process.env.FIREBASE_CLIENT_EMAIL,
          "client_id": process.env.FIREBASE_CLIENT_ID || "",
          "auth_uri": "https://accounts.google.com/o/oauth2/auth",
          "token_uri": "https://oauth2.googleapis.com/token",
          "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
          "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL || ""
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });
      console.log('Firebase Admin SDK initialized successfully');
    }
  } catch (initError) {
    console.error('Firebase initialization error:', initError);
    // In local dev, we'll continue even if Firebase init fails
    if (!isLocalDev) {
      throw initError;
    }
  }
}

const db = admin.firestore();

// Database operation utility functions
async function getVideoDocument(videoId) {
  if (isLocalDev && (!admin.apps.length || !db)) {
    console.log(`[LOCAL-DEV] Cannot access Firestore in local development without proper environment variables`);
    throw new Error('Firebase not initialized - set up environment variables in .env.local for local development');
  }
  
  console.log(`Getting video document ${videoId} from Firestore`);
  const videoRef = db.collection('exerciseVideos').doc(videoId);
  return await videoRef.get();
}

async function updateVideoWithGifURL(videoId, gifURL) {
  if (isLocalDev && (!admin.apps.length || !db)) {
    console.log(`[LOCAL-DEV] Cannot update Firestore in local development without proper environment variables`);
    throw new Error('Firebase not initialized - set up environment variables in .env.local for local development');
  }
  
  console.log(`Updating video ${videoId} with GIF URL: ${gifURL}`);
  const videoRef = db.collection('exerciseVideos').doc(videoId);
  await videoRef.update({ gifURL });
  return true;
}

async function downloadVideo(videoURL, filePath) {
  console.log(`Downloading video from ${videoURL}`);
  const res = await fetch(videoURL);
  const fileStream = fs.createWriteStream(filePath);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on('error', reject);
    fileStream.on('finish', resolve);
  });
  console.log(`Video downloaded to ${filePath}`);
}

async function generateGIF(videoPath, gifPath) {
  console.log(`Generating GIF from ${videoPath}`);
  try {
    // First attempt with higher quality
    const command = `ffmpeg -i ${videoPath} -vf "fps=10,scale=320:-1:flags=lanczos" -c:v gif -f gif ${gifPath}`;
    await execAsync(command);
    
    // Skip gifsicle optimization in local development
    if (!isLocalDev) {
      try {
        console.log(`Optimizing GIF with gifsicle at path: ${gifsiclePath}`);
        await execAsync(`${gifsiclePath} --optimize=3 ${gifPath} -o ${gifPath}`);
      } catch (optimizeError) {
        console.warn(`Warning: Gifsicle optimization failed: ${optimizeError.message}`);
        console.log('Continuing with unoptimized GIF');
        // Continue without optimization if gifsicle fails
      }
    } else {
      console.log('Skipping gifsicle optimization in local development');
    }
    
    // Check if the file is too large (over 1MB)
    const stats = fs.statSync(gifPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    if (fileSizeInMB > 1) {
      console.log(`GIF is too large (${fileSizeInMB.toFixed(2)}MB), generating smaller version`);
      
      // Try with lower quality
      const lowerQualityCommand = `ffmpeg -i ${videoPath} -vf "fps=5,scale=256:-1:flags=lanczos" -c:v gif -f gif ${gifPath}`;
      await execAsync(lowerQualityCommand);
      
      // Skip gifsicle optimization in local development
      if (!isLocalDev) {
        try {
          console.log(`Optimizing smaller GIF with gifsicle`);
          await execAsync(`${gifsiclePath} --optimize=3 ${gifPath} -o ${gifPath}`);
        } catch (optimizeError) {
          console.warn(`Warning: Gifsicle optimization failed for smaller GIF: ${optimizeError.message}`);
          console.log('Continuing with unoptimized GIF');
          // Continue without optimization if gifsicle fails
        }
      } else {
        console.log('Skipping gifsicle optimization in local development');
      }
    }
    
    console.log(`GIF generated at ${gifPath}`);
  } catch (error) {
    console.error(`Error generating GIF: ${error.message}`);
    throw error;
  }
}

async function uploadGIF(gifPath, destination) {
  console.log(`Uploading GIF to ${destination}`);
  const bucket = admin.storage().bucket();
  const [file] = await bucket.upload(gifPath, {
    destination: destination,
    public: true,
    metadata: { 
      cacheControl: 'public, max-age=31536000',
      contentType: 'image/gif'
    },
  });
  
  // Get the public URL
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
  console.log(`GIF uploaded to ${publicUrl}`);
  return publicUrl;
}

// Utility function to properly capitalize exercise names (like our stringUtils.ts)
function capitalizeWords(text) {
  if (!text) return '';
  
  return text
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

async function processVideo(exerciseId, videoId, exerciseName) {
  console.log(`Processing video ${videoId} for exercise ID: ${exerciseId}`);
  console.log(`Environment: ${isLocalDev ? 'Local Development' : 'Production'}`);
  
  // Check if Firebase is initialized
  if (!admin.apps.length || !db) {
    throw new Error('Firebase not initialized. Please ensure all required environment variables are set in .env.local for local development or in Netlify environment variables for production.');
  }
  
  // Use the provided exercise name for storage, or capitalize the exercise ID if not provided
  const storageFolderName = exerciseName || capitalizeWords(exerciseId);
  console.log(`Using storage folder name: ${storageFolderName}`);
  
  // Get the video document
  const videoDoc = await getVideoDocument(videoId);
  
  if (!videoDoc.exists) {
    throw new Error(`Video ${videoId} not found in exerciseVideos collection!`);
  }
  
  const video = videoDoc.data();
  console.log(`Found video ${videoId} with exercise name: ${video.exercise}`);
  
  // Skip if the video already has a GIF
  if (video.gifURL) {
    console.log(`Video ${videoId} already has a GIF at ${video.gifURL}`);
    return video.gifURL;
  }
  
  let gifURL;
  
  // Create temp directory if it doesn't exist
  const tmpDir = '/tmp';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  
  // Define paths
  const videoPath = `/tmp/${path.basename(video.videoURL)}`;
  const gifPath = `/tmp/${video.id}.gif`;
  
  try {
    // Try the full GIF generation process
    await downloadVideo(video.videoURL, videoPath);
    await generateGIF(videoPath, gifPath);
    
    // Use the storage folder name for consistent storage path
    gifURL = await uploadGIF(gifPath, `gifs/${storageFolderName}/${video.id}.gif`);
  } catch (error) {
    console.error(`Error in GIF generation: ${error.message}`);
    console.log('Attempting alternative method - using a placeholder image instead of GIF');
    
    try {
      // If GIF generation fails, use a placeholder
      // Try to extract thumbnail URL from the video URL
      const placeholderURL = video.videoURL.replace(/\.[^/.]+$/, '.jpg');
      if (!placeholderURL.endsWith('.jpg')) {
        // If replacement didn't work, just append .jpg
        gifURL = `${video.videoURL}.jpg`;
      } else {
        gifURL = placeholderURL;
      }
      
      console.log(`Using placeholder URL instead of GIF: ${gifURL}`);
    } catch (fallbackError) {
      console.error(`Fallback method also failed: ${fallbackError.message}`);
      throw error; // Throw the original error
    }
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
      if (fs.existsSync(gifPath)) {
        fs.unlinkSync(gifPath);
      }
    } catch (cleanupError) {
      console.warn(`Error cleaning up temp files: ${cleanupError.message}`);
    }
  }

  // Update the video document with the GIF URL
  await updateVideoWithGifURL(videoId, gifURL);
  console.log(`Updated video ${videoId} in exerciseVideos collection with GIF URL: ${gifURL}`);
  
  console.log(`Video ${videoId} processed successfully, GIF URL: ${gifURL}`);
  return gifURL;
}

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }
  
  try {
    // Parse the request body
    const payload = JSON.parse(event.body);
    const { exerciseId, videoId, exerciseName } = payload;
    
    if (!exerciseId || !videoId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing exerciseId or videoId parameter' })
      };
    }
    
    console.log(`Processing request for video ${videoId}, exercise ID ${exerciseId}, and exercise name ${exerciseName || 'not provided'}`);
    
    // Process the video (using the exercise ID and name properly)
    const gifURL = await processVideo(exerciseId, videoId, exerciseName);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `GIF generated successfully for video ${videoId}`,
        gifURL
      })
    };
  } catch (error) {
    console.error('Error processing video:', error);
    
    // Provide more detailed error information
    let errorDetails = {
      message: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace',
      name: error.name || 'UnknownError'
    };
    
    // Log additional environment info
    console.log('Environment info:');
    console.log(`Node version: ${process.version}`);
    console.log(`Platform: ${process.platform}`);
    console.log(`Temp directory exists: ${fs.existsSync('/tmp')}`);
    
    try {
      // Check if ffmpeg is available
      const { stdout } = await execAsync('which ffmpeg');
      console.log(`ffmpeg location: ${stdout.trim()}`);
    } catch (ffmpegError) {
      console.error('ffmpeg not found in PATH:', ffmpegError.message);
      errorDetails.ffmpeg = 'Not found in PATH';
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: errorDetails
      })
    };
  }
}; 