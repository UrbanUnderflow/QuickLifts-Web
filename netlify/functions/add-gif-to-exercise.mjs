import admin from 'firebase-admin';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

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
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-1qxb0@quicklifts-dd3f1.iam.gserviceaccount.com",
      "universe_domain": "googleapis.com"
    }),
  });
}

const db = admin.firestore();
const ffmpeg = createFFmpeg({ log: true });

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
  await ffmpeg.load();
  ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoPath));
  await ffmpeg.run('-i', 'input.mp4', '-vf', 'fps=10,scale=320:-1:flags=lanczos', 'output.gif');
  const data = ffmpeg.FS('readFile', 'output.gif');
  fs.writeFileSync(gifPath, data);
}

async function uploadGIF(gifPath, destination) {
  const bucket = admin.storage().bucket('quicklifts-dd3f1.appspot.com');
  const [file] = await bucket.upload(gifPath, {
    destination: destination,
    public: true,
    metadata: { cacheControl: 'public, max-age=31536000' },
  });
  return file.publicUrl();
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
export async function handler(event) {
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
}