const admin = require('firebase-admin');
const fetch = require('node-fetch');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');
const { exec } = require('child_process');
const path = require('path');

// Initialize Firebase Admin SDK
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
    }),
  });
}

const db = admin.firestore();
const storage = new Storage();

async function downloadVideo(videoURL, filePath) {
  const res = await fetch(videoURL);
  const fileStream = fs.createWriteStream(filePath);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on('error', reject);
    fileStream.on('finish', resolve);
  });
}

async function generateGIF(videoPath, gifPath) {
  return new Promise((resolve, reject) => {
    const command = `ffmpeg -i ${videoPath} -vf "fps=10,scale=320:-1:flags=lanczos" -c:v gif -f gif ${gifPath}`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(`Error generating GIF: ${error.message}`);
      }
      resolve();
    });
  });
}

async function uploadGIF(gifPath, destination) {
  await storage.bucket('quicklifts-dd3f1.appspot.com').upload(gifPath, {
    destination: destination,
    public: true,
    metadata: { cacheControl: 'public, max-age=31536000' },
  });
  const [url] = await storage.bucket('quicklifts-dd3f1.appspot.com').file(destination).getSignedUrl({
    action: 'read',
    expires: '03-17-2025'
  });
  return url;
}

async function processVideo(exerciseID, video) {
  const videoPath = `/tmp/${path.basename(video.videoURL)}`;
  const gifPath = `/tmp/${video.id}.gif`;

  await downloadVideo(video.videoURL, videoPath);
  await generateGIF(videoPath, gifPath);
  const gifURL = await uploadGIF(gifPath, `gifs/${video.id}.gif`);

  video.gifURL = gifURL;
  await updateExerciseVideo(exerciseID, video);
}

async function updateExerciseVideo(exerciseID, updatedVideo) {
  const exerciseRef = db.collection('exercises').doc(exerciseID);
  const exerciseDoc = await exerciseRef.get();
  if (!exerciseDoc.exists) {
    throw new Error('No such document!');
  }
  const exercise = exerciseDoc.data();

  const videoIndex = exercise.videos.findIndex(v => v.id === updatedVideo.id);
  if (videoIndex === -1) {
    throw new Error('Video not found in exercise!');
  }
  exercise.videos[videoIndex] = updatedVideo;

  await exerciseRef.set(exercise, { merge: true });
}

async function processAllExerciseVideos() {
  const exercisesSnapshot = await db.collection('exercises').get();
  const exercises = exercisesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  for (const exercise of exercises) {
    if (exercise.videos && exercise.videos.length > 0) {
      for (const video of exercise.videos) {
        await processVideo(exercise.id, video);
      }
    }
  }
}

// Handler function for Netlify
exports.handler = async (event) => {
  try {
    await processAllExerciseVideos();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'All exercise videos processed successfully.' }),
    };
  } catch (error) {
    console.error('Error processing exercise videos:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};