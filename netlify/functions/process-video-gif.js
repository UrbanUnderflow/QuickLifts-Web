// Log the environment at the very beginning to help with debugging
console.log('==== Function Starting ====');
console.log('Environment variables present:', {
  NODE_ENV: process.env.NODE_ENV || 'not set',
  NETLIFY: process.env.NETLIFY || 'not set',
  NETLIFY_DEV: process.env.NETLIFY_DEV || 'not set',
  CONTEXT: process.env.CONTEXT || 'not set'
});

/**
 * IMPORTANT: FFmpeg Setup for Netlify Functions
 * 
 * This function requires FFmpeg to generate GIFs from videos.
 * 
 * For local development:
 * 1. Install FFmpeg on your local machine: `brew install ffmpeg` (macOS) or equivalent for your OS
 * 2. Make sure it's in your PATH
 * 
 * For production deployment on Netlify:
 * Option 1: Use a Netlify Build Plugin
 *   - Add the netlify-plugin-inline-functions-env plugin to your netlify.toml
 *   - This allows you to include binaries like FFmpeg in your functions
 *   - See: https://github.com/netlify/netlify-plugin-inline-functions-env
 * 
 * Option 2: Use a custom runtime with FFmpeg pre-installed
 *   - Create a custom runtime using AWS Lambda Layers with FFmpeg
 *   - Configure Netlify to use this custom runtime
 * 
 * Option 3: Consider using a dedicated service for video processing
 *   - For production use, consider services like Cloudinary or Imgix that handle video/GIF processing
 */

// Debug all environment variables with FIREBASE or DEV in their name
console.log('==== Debugging Environment Variables ====');
Object.keys(process.env).forEach(key => {
  if (key.includes('FIREBASE') || key.includes('DEV')) {
    // Only show first few characters of values for security
    const value = process.env[key];
    const safeValue = value ? `${value.substring(0, 5)}...` : 'not set';
    console.log(`${key}: ${safeValue}`);
  }
});

// Specifically check for the client email variable
console.log('NEXT_DEV_FIREBASE_CLIENT_EMAIL exists:', !!process.env.NEXT_DEV_FIREBASE_CLIENT_EMAIL);
if (process.env.NEXT_DEV_FIREBASE_CLIENT_EMAIL) {
  console.log('NEXT_DEV_FIREBASE_CLIENT_EMAIL value:', process.env.NEXT_DEV_FIREBASE_CLIENT_EMAIL);
}

const admin = require('firebase-admin');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configure environment based on dev/prod mode
const configureEnvironment = () => {
  const isDev = process.env.NODE_ENV !== 'production' || process.env.NETLIFY_DEV === 'true';
  console.log(`Running in ${isDev ? 'development' : 'production'} mode`);
  
  // If in dev mode, prioritize dev env variables
  if (isDev) {
    console.log('Using development environment variables');
    
    if (process.env.NEXT_DEV_PUBLIC_FIREBASE_PROJECT_ID) {
      console.log('Using NEXT_DEV_PUBLIC_FIREBASE_PROJECT_ID for FIREBASE_PROJECT_ID');
      process.env.FIREBASE_PROJECT_ID = process.env.NEXT_DEV_PUBLIC_FIREBASE_PROJECT_ID;
    }
    
    if (process.env.NEXT_DEV_PUBLIC_FIREBASE_STORAGE_BUCKET) {
      console.log('Using NEXT_DEV_PUBLIC_FIREBASE_STORAGE_BUCKET for FIREBASE_STORAGE_BUCKET');
      process.env.FIREBASE_STORAGE_BUCKET = process.env.NEXT_DEV_PUBLIC_FIREBASE_STORAGE_BUCKET;
    }
    
    if (process.env.NEXT_DEV_FIREBASE_CLIENT_EMAIL) {
      console.log('Using NEXT_DEV_FIREBASE_CLIENT_EMAIL for FIREBASE_CLIENT_EMAIL');
      process.env.FIREBASE_CLIENT_EMAIL = process.env.NEXT_DEV_FIREBASE_CLIENT_EMAIL;
    }
    
    if (process.env.NEXT_DEV_FIREBASE_PRIVATE_KEY) {
      console.log('Using NEXT_DEV_FIREBASE_PRIVATE_KEY for FIREBASE_PRIVATE_KEY');
      process.env.FIREBASE_PRIVATE_KEY = process.env.NEXT_DEV_FIREBASE_PRIVATE_KEY;
    }
    
    if (process.env.NEXT_DEV_FIREBASE_SECRET_KEY) {
      console.log('Using NEXT_DEV_FIREBASE_SECRET_KEY for FIREBASE_SECRET_KEY');
      process.env.FIREBASE_SECRET_KEY = process.env.NEXT_DEV_FIREBASE_SECRET_KEY;
    }
  } else {
    console.log('Using production environment variables');
    
    // In production, use the regular NEXT_PUBLIC_ variables
    if (!process.env.FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      console.log('Using NEXT_PUBLIC_FIREBASE_PROJECT_ID for FIREBASE_PROJECT_ID');
      process.env.FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    }
    
    if (!process.env.FIREBASE_STORAGE_BUCKET && process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
      console.log('Using NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET for FIREBASE_STORAGE_BUCKET');
      process.env.FIREBASE_STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    }
  }
  
  // Log available Firebase-related variables to help with debugging
  const availableVars = Object.keys(process.env)
    .filter(key => key.includes('FIREBASE'))
    .map(key => key);
  
  console.log('Available Firebase-related environment variables:', availableVars);
  
  return isDev;
};

// Run the environment configuration
const isDev = configureEnvironment();

// DEVELOPMENT FALLBACK: If we're in development mode and the variables aren't set, set them manually
// This is a temporary workaround for local development only
if (isDev && !process.env.FIREBASE_CLIENT_EMAIL) {
  console.log('Development mode detected but FIREBASE_CLIENT_EMAIL is not set. Using hardcoded development values as fallback.');
  
  // Set the development Firebase Admin SDK credentials directly
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'quicklifts-dev-01';
  process.env.FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'quicklifts-dev-01.appspot.com';
  process.env.FIREBASE_CLIENT_EMAIL = 'firebase-adminsdk-am7p0@quicklifts-dev-01.iam.gserviceaccount.com';
  process.env.FIREBASE_PRIVATE_KEY = process.env.NEXT_DEV_FIREBASE_PRIVATE_KEY || '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDsRTDLy9TashK0\n4G1Wj3Xz5ANr2tE2t1Fz6xPuZVUnN+13hcXoIddYMIplT+F8+sIzLdXEIdvard7q\nVgTUTOKm/r57RzQ8cXGqJUFTE8u8yagd4hY0BcUgaZeyFdC+l97Q9EPzpRXbeKEP\n0nuCtfbD2CynQn1R/il9O46yal4EVEemnE92mLHKK21Y5SkNratEgBRdmzVj3UnT\nko5Ol1y0My1KMxzuTahoiKBNoM5Gj/ZR2SX5/4ExGeAXiTEJXfW9i6KHXea6ZlOg\nM8w0rCMc6OGBEiTERW+KeQFkkeo0l3TDZJqwx/BXO/bO/lFBggyojIW1Pm9U/zhu\nSSwY537nAgMBAAECggEAYZdaxnMVIpg3PdsNjpmHQQxHlX82t4EU9ep9uxTEDYT+\nY0YwLuf7iQPTxnEuVG9HU9h02aSaqUL0Npr9N6viWtQSXd1VaDn7lyn4R5Z/qyUo\ned9vCGHxwKec7wQvyun0MR8UCkmAM70p2d05Aw6iNNbP6u590SZIgN/e2zcwSlyy\nZ3+KCAv3Cq0FtXuFzwtYxbmJlYSEIg3o2t4Sm9l/NZzQ6NpInenq4JL2yoyUrhq0\nwvVgun5cDCr7fFWwlmqcbkNiOVZJMRq6qx8DUSpU5UQe9U0IlAM54URosbRJEzqC\nI7kv+iKBZo+1sNvc8ZWuYUvD8Q+nb1upnZokcshaoQKBgQD09vinnGh0WqGEJqvc\nXNKrvoveBWxqr8Qe6rp6zw3CAOTECi8cKXPwCiqEWhyLoq91VGU/IlTZJHa17IyH\nVKmUJBsfQjGv9nbrdMc674GzGKLxZD9lMf2rkZgfkGolnpdlxHU4apcGXQ7w6G+Q\nsMH1zcx+syg89pEk/bhRQDtF6QKBgQD26fOSS1m6EonQDgejZ+S9lETUeUzUlxCl\n0uUmkG05MEoOVX2WNL1+PdF4olM5SkmZsd8SLOuaDE5bomEk1aQu03z0Gpe3NzKI\n2rPUvAYyqelorOjcHx2DSCmzfRD8+RNH9l+aYRncvw8xgsDICqniePuOhMRQTM+M\nkkqqMOYMTwKBgATjmPrfaEZKOMcGbo+rWpkK6Ie52/wVHfjv/mDNGR0yH166RU5u\nlV3JFigmFEPFL3NMB+lGqiLbU3M2EWfyDKBkSBZLn+o/JQh2ADPw68nDSB1BPvKq\nGMH/2eVnYHb3v1XMofpKRlFeMhokyXU90eEyBk7RDJCK60KtvawBeC1hAoGBAPKu\n04XwpYoremSRxZQoIzzqJBSp/IfeyrARbsTOo2vYOJGKGVuvDqir3dyxvxbKGzkD\nCHt2x0Kr4cBTAyQPD8Yue9v43zFnATZdru7itzzIn+8QM/dWZc2I+eO+gxoBPaA3\nWZQE6ER9TVOebhiv0nYT7zwO5lz+gehqSRSp5xIlAoGANFNMfo2YG4V6d/tyMYOZ\nb+t6a0z4Hy0zZFnigBzsgoJirEq9NN1ysFNHOVqzsHe3xODKXsMrNdTjYXhNQmlZ\nNqbWXaCl4Ks01i4cJBK0U59NG3QGRgy+0ChYdrJGfOYcj8K7s3qUA8tfuYA6NB2g\nTooQEXgXv9x0Bp7sFWzFmNA=\n-----END PRIVATE KEY-----\n';
  process.env.FIREBASE_SECRET_KEY = process.env.NEXT_DEV_FIREBASE_SECRET_KEY || process.env.FIREBASE_PRIVATE_KEY;
  process.env.FIREBASE_PRIVATE_KEY_ID = '9ebe0da0989c5ae7afd4e6976901bdbe870206d7';
  
  console.log('Development Firebase credentials set manually as fallback');
}

let gifsiclePath = 'gifsicle'; // Default fallback

// Only try to require gifsicle in production
if (!isDev) {
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
let db;
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
    
    // Log available Firebase-related variables to help with debugging
    const availableVars = Object.keys(process.env)
      .filter(key => key.includes('FIREBASE'))
      .map(key => key);
    
    console.log('Available Firebase-related environment variables:', availableVars);
    
    throw new Error(`Firebase credentials not properly configured. Missing: ${missingVars.join(', ')}`);
  }
  
  // Initialize Firebase Admin SDK with environment variables
  if (admin.apps.length === 0) {
    console.log('Initializing Firebase Admin SDK...');
    console.log(`Using project ID: ${process.env.FIREBASE_PROJECT_ID}`);
    console.log(`Using storage bucket: ${process.env.FIREBASE_STORAGE_BUCKET}`);
    console.log(`Using client email: ${process.env.FIREBASE_CLIENT_EMAIL}`);
    
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
  } else {
    console.log('Firebase Admin SDK already initialized');
  }
  
  // Get Firestore database instance
  db = admin.firestore();
} catch (initError) {
  console.error('Firebase initialization error:', initError);
  throw initError;
}

// Add this function after the Firebase initialization block

/**
 * Helper function to check environment variables
 * This can be called from the handler to debug environment issues
 */
function checkEnvironment() {
  const envInfo = {
    isDev,
    nodeEnv: process.env.NODE_ENV,
    netlifyDev: process.env.NETLIFY_DEV,
    context: process.env.CONTEXT,
    firebaseInitialized: admin.apps.length > 0,
    dbInitialized: !!db,
    firebaseVarsPresent: {
      FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
      FIREBASE_SECRET_KEY: !!process.env.FIREBASE_SECRET_KEY,
      FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_STORAGE_BUCKET: !!process.env.FIREBASE_STORAGE_BUCKET
    },
    nextPublicVarsPresent: {
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    }
  };
  
  console.log('Environment check:', JSON.stringify(envInfo, null, 2));
  return envInfo;
}

// Database operation utility functions
async function getVideoDocument(videoId) {
  console.log(`Getting video document ${videoId} from Firestore`);
  try {
    const videoRef = db.collection('exerciseVideos').doc(videoId);
    const doc = await videoRef.get();
    
    if (!doc.exists) {
      console.error(`Video document ${videoId} not found in Firestore`);
      throw new Error(`Video ${videoId} not found`);
    }
    
    console.log(`Successfully retrieved video document ${videoId}`);
    return doc;
  } catch (error) {
    console.error(`Error getting video document ${videoId}:`, error);
    throw error;
  }
}

async function updateVideoWithGifURL(videoId, gifURL) {
  console.log(`Updating video ${videoId} with GIF URL: ${gifURL}`);
  try {
    const videoRef = db.collection('exerciseVideos').doc(videoId);
    await videoRef.update({ 
      gifURL,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Successfully updated video ${videoId} with GIF URL`);
    return true;
  } catch (error) {
    console.error(`Error updating video ${videoId} with GIF URL:`, error);
    throw error;
  }
}

async function downloadVideo(videoURL, filePath) {
  console.log(`Downloading video from ${videoURL}`);
  try {
    const res = await fetch(videoURL);
    
    if (!res.ok) {
      throw new Error(`Failed to download video: ${res.status} ${res.statusText}`);
    }
    
    const fileStream = fs.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on('error', reject);
      fileStream.on('finish', resolve);
    });
    
    // Verify the file was downloaded
    const stats = fs.statSync(filePath);
    console.log(`Video downloaded to ${filePath} (${stats.size} bytes)`);
    
    if (stats.size === 0) {
      throw new Error('Downloaded video file is empty');
    }
    
    return true;
  } catch (error) {
    console.error(`Error downloading video:`, error);
    throw error;
  }
}

async function generateGIF(videoPath, gifPath) {
  console.log(`Generating GIF from ${videoPath}`);
  try {
    // Check if the video file exists and has content
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file does not exist at path: ${videoPath}`);
    }
    
    const videoStats = fs.statSync(videoPath);
    if (videoStats.size === 0) {
      throw new Error(`Video file is empty at path: ${videoPath}`);
    }
    
    console.log(`Video file exists and has size: ${videoStats.size} bytes`);
    
    // First attempt with higher quality
    const command = `ffmpeg -i ${videoPath} -vf "fps=10,scale=320:-1:flags=lanczos" -c:v gif -f gif ${gifPath}`;
    console.log(`Executing ffmpeg command: ${command}`);
    
    try {
      const { stdout, stderr } = await execAsync(command);
      console.log('ffmpeg stdout:', stdout);
      if (stderr) console.log('ffmpeg stderr:', stderr);
    } catch (ffmpegError) {
      console.error(`ffmpeg error:`, ffmpegError);
      throw ffmpegError;
    }
    
    // Verify the GIF was created
    if (!fs.existsSync(gifPath)) {
      throw new Error(`GIF file was not created at path: ${gifPath}`);
    }
    
    // Skip gifsicle optimization in development
    if (!isDev) {
      try {
        console.log(`Optimizing GIF with gifsicle at path: ${gifsiclePath}`);
        await execAsync(`${gifsiclePath} --optimize=3 ${gifPath} -o ${gifPath}`);
      } catch (optimizeError) {
        console.warn(`Warning: Gifsicle optimization failed: ${optimizeError.message}`);
        console.log('Continuing with unoptimized GIF');
        // Continue without optimization if gifsicle fails
      }
    } else {
      console.log('Skipping gifsicle optimization in development mode');
    }
    
    // Check if the file is too large (over 1MB)
    const stats = fs.statSync(gifPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    if (fileSizeInMB > 1) {
      console.log(`GIF is too large (${fileSizeInMB.toFixed(2)}MB), generating smaller version`);
      
      // Try with lower quality
      const lowerQualityCommand = `ffmpeg -i ${videoPath} -vf "fps=5,scale=256:-1:flags=lanczos" -c:v gif -f gif ${gifPath}`;
      console.log(`Executing lower quality ffmpeg command: ${lowerQualityCommand}`);
      
      try {
        const { stdout, stderr } = await execAsync(lowerQualityCommand);
        console.log('Lower quality ffmpeg stdout:', stdout);
        if (stderr) console.log('Lower quality ffmpeg stderr:', stderr);
      } catch (ffmpegError) {
        console.error(`Lower quality ffmpeg error:`, ffmpegError);
        throw ffmpegError;
      }
      
      // Skip gifsicle optimization in development
      if (!isDev) {
        try {
          console.log(`Optimizing smaller GIF with gifsicle`);
          await execAsync(`${gifsiclePath} --optimize=3 ${gifPath} -o ${gifPath}`);
        } catch (optimizeError) {
          console.warn(`Warning: Gifsicle optimization failed for smaller GIF: ${optimizeError.message}`);
          console.log('Continuing with unoptimized GIF');
          // Continue without optimization if gifsicle fails
        }
      } else {
        console.log('Skipping gifsicle optimization in development mode');
      }
    }
    
    // Final verification
    if (!fs.existsSync(gifPath)) {
      throw new Error(`Final GIF file does not exist at path: ${gifPath}`);
    }
    
    const finalStats = fs.statSync(gifPath);
    console.log(`GIF generated at ${gifPath} (${finalStats.size} bytes)`);
    
    return true;
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
  
  // Check if Firebase is initialized
  if (!admin.apps.length || !db) {
    console.error('Firebase not initialized for processVideo function');
    throw new Error('Firebase not initialized. Please ensure all required environment variables are set.');
  }
  
  // Use the provided exercise name for storage, or capitalize the exercise ID if not provided
  const storageFolderName = exerciseName || capitalizeWords(exerciseId);
  console.log(`Using storage folder name: ${storageFolderName}`);
  
  // Get the video document
  let videoDoc;
  try {
    videoDoc = await getVideoDocument(videoId);
  } catch (error) {
    console.error(`Failed to get video document: ${error.message}`);
    throw new Error(`Failed to get video document: ${error.message}`);
  }
  
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
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
      console.log(`Created temp directory at ${tmpDir}`);
    } catch (mkdirError) {
      console.error(`Failed to create temp directory: ${mkdirError.message}`);
      throw new Error(`Failed to create temp directory: ${mkdirError.message}`);
    }
  }
  
  // Define paths
  const videoPath = `/tmp/${path.basename(video.videoURL)}`;
  const gifPath = `/tmp/${video.id}.gif`;
  
  try {
    // Try the full GIF generation process
    console.log(`Downloading video from ${video.videoURL}`);
    await downloadVideo(video.videoURL, videoPath);
    
    console.log(`Generating GIF from ${videoPath}`);
    await generateGIF(videoPath, gifPath);
    
    // Use the storage folder name for consistent storage path
    const storagePath = `gifs/${storageFolderName}/${video.id}.gif`;
    console.log(`Uploading GIF to ${storagePath}`);
    gifURL = await uploadGIF(gifPath, storagePath);
  } catch (error) {
    console.error(`Error in GIF generation: ${error.message}`);
    // No fallback - just throw the error
    throw new Error(`Failed to generate GIF: ${error.message}`);
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
        console.log(`Cleaned up temporary video file: ${videoPath}`);
      }
      if (fs.existsSync(gifPath)) {
        fs.unlinkSync(gifPath);
        console.log(`Cleaned up temporary GIF file: ${gifPath}`);
      }
    } catch (cleanupError) {
      console.warn(`Error cleaning up temp files: ${cleanupError.message}`);
    }
  }

  // Update the video document with the GIF URL
  try {
    await updateVideoWithGifURL(videoId, gifURL);
    console.log(`Updated video ${videoId} in exerciseVideos collection with GIF URL: ${gifURL}`);
  } catch (updateError) {
    console.error(`Failed to update video with GIF URL: ${updateError.message}`);
    throw new Error(`Failed to update video with GIF URL: ${updateError.message}`);
  }
  
  console.log(`Video ${videoId} processed successfully, GIF URL: ${gifURL}`);
  return gifURL;
}

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }
  
  try {
    // Run environment check at the beginning of each request
    const envInfo = checkEnvironment();
    
    // Check if FFmpeg is available
    try {
      const { stdout, stderr } = await execAsync('which ffmpeg');
      console.log(`FFmpeg found at: ${stdout.trim()}`);
      if (stderr) {
        console.warn('FFmpeg stderr:', stderr);
      }
    } catch (ffmpegError) {
      console.error('FFmpeg not found in PATH:', ffmpegError.message);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'FFmpeg is not available. Cannot generate GIFs without FFmpeg.',
          details: {
            message: ffmpegError.message,
            environment: envInfo
          }
        })
      };
    }
    
    // Parse the request body
    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON in request body' 
        })
      };
    }
    
    const { exerciseId, videoId, exerciseName } = payload;
    
    if (!exerciseId || !videoId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false,
          error: 'Missing exerciseId or videoId parameter' 
        })
      };
    }
    
    console.log(`Processing request for video ${videoId}, exercise ID ${exerciseId}, and exercise name ${exerciseName || 'not provided'}`);
    
    // Check if Firebase is properly initialized
    if (!admin.apps.length || !db) {
      console.error('Firebase is not properly initialized');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false, 
          error: 'Firebase is not properly initialized',
          details: {
            appsInitialized: admin.apps.length > 0,
            dbInitialized: !!db,
            environment: envInfo
          }
        })
      };
    }
    
    // Process the video (using the exercise ID and name properly)
    const gifURL = await processVideo(exerciseId, videoId, exerciseName);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
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
      name: error.name || 'UnknownError',
      environment: checkEnvironment()
    };
    
    // Log additional environment info
    console.log('Environment info:');
    console.log(`Node version: ${process.version}`);
    console.log(`Platform: ${process.platform}`);
    console.log(`Temp directory exists: ${fs.existsSync('/tmp')}`);
    console.log(`Firebase apps initialized: ${admin.apps.length}`);
    
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: errorDetails
      })
    };
  }
}; 