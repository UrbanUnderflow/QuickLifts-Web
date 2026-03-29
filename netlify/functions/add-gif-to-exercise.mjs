import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import gifsicle from 'gifsicle';
import firebaseConfig from './config/firebase.js';

const { admin } = firebaseConfig;
const execAsync = promisify(exec);

const db = admin.firestore();

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
  const command = `ffmpeg -i ${videoPath} -vf "fps=10,scale=320:-1:flags=lanczos" -c:v gif -f gif ${gifPath}`;
  await execAsync(command);
  await execAsync(`${gifsicle} --optimize=3 ${gifPath} -o ${gifPath}`);
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
