// Import v2 functions
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");
const path = require("path");
const os = require("os");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static"); // Needed by fluent-ffmpeg
const { PubSub } = require('@google-cloud/pubsub');

// Ensure FFmpeg path is set (especially important for Cloud Functions environment)
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path); // Point to ffprobe

// Initialize Firebase Admin and Storage if not already done
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();
const storage = new Storage();

const THUMBNAIL_BUCKET = admin.storage().bucket().name; // Use the default bucket
const THUMBNAIL_FOLDER = "thumbnails";
const THUMBNAIL_MAX_WIDTH = 320; // Max width for thumbnails
const THUMBNAIL_SUFFIX = "_thumb.jpg";

// GIF generation config (shares bucket with thumbnails)
const GIF_FOLDER = "gifs";
const GIF_MAX_WIDTH = 320;
const GIF_SUFFIX = ".gif";

const pubSubClient = new PubSub();
const TOPIC_NAME = 'thumbnail-generation-requests'; // Define topic name

/**
 * Generates a thumbnail (and best-effort GIF preview) for a video stored in Firebase Storage.
 * @param {string} videoUrl The URL of the video in Firebase Storage.
 * @param {string} exerciseVideoId The ID of the ExerciseVideo document.
 * @returns {Promise<{ thumbnailUrl: string, gifUrl?: string }>} Public URLs of the generated assets.
 */
async function generateThumbnail(videoUrl, exerciseVideoId) {
  logger.info(`[Thumbnail] Starting generation for video: ${videoUrl}, ID: ${exerciseVideoId}`);

  let bucketName;
  let filePath;

  if (videoUrl && videoUrl.startsWith('gs://')) {
      bucketName = videoUrl.split('/')[2];
      filePath = videoUrl.split('/').slice(3).join('/');
      logger.info(`[Thumbnail] Parsed gs:// URL. Bucket: ${bucketName}, Path: ${filePath}`);
  } else if (videoUrl && videoUrl.startsWith('https://firebasestorage.googleapis.com')) {
      // Parse HTTPS URL: https://firebasestorage.googleapis.com/v0/b/BUCKET_NAME/o/FILE_PATH?alt=media&token=TOKEN
      const urlParts = videoUrl.split('/');
      const bucketIndex = urlParts.findIndex(part => part === 'b') + 1;
      const pathIndex = urlParts.findIndex(part => part === 'o') + 1;
      if (bucketIndex > 0 && pathIndex > 0 && pathIndex > bucketIndex) {
          bucketName = urlParts[bucketIndex];
          // Decode the URL-encoded path and remove query params
          filePath = decodeURIComponent(urlParts.slice(pathIndex).join('/').split('?')[0]);
          logger.info(`[Thumbnail] Parsed https:// URL. Bucket: ${bucketName}, Path: ${filePath}`);
      } else {
          throw new Error(`[Thumbnail] Could not parse HTTPS URL format: ${videoUrl}`);
      }
  } else {
      throw new Error(`[Thumbnail] Invalid or unsupported videoURL format: ${videoUrl}. Must start with gs:// or https://firebasestorage.googleapis.com`);
  }

  if (!bucketName || !filePath) {
       throw new Error(`[Thumbnail] Failed to extract bucket name or file path from URL: ${videoUrl}`);
  }
  
  const fileName = path.basename(filePath);
  const tempLocalFile = path.join(os.tmpdir(), fileName);
  const tempLocalThumb = path.join(os.tmpdir(), `thumb_${exerciseVideoId}.jpg`);
  const thumbStoragePath = `${THUMBNAIL_FOLDER}/${exerciseVideoId}${THUMBNAIL_SUFFIX}`;

  // Temp + storage paths for GIF
  const tempLocalGif = path.join(os.tmpdir(), `gif_${exerciseVideoId}.gif`);
  const gifStoragePath = `${GIF_FOLDER}/${exerciseVideoId}${GIF_SUFFIX}`;

  const bucket = storage.bucket(bucketName); // Use parsed bucketName
  const thumbBucket = storage.bucket(THUMBNAIL_BUCKET);

  try {
    // 1. Download video to temporary location
    logger.info(`[Thumbnail] Downloading video from bucket ${bucketName}, path ${filePath} to ${tempLocalFile}`);
    await bucket.file(filePath).download({ destination: tempLocalFile });
    logger.info(`[Thumbnail] Video downloaded successfully: ${tempLocalFile}`);

    // 2. Generate thumbnail using ffmpeg
    logger.info(`[Thumbnail] Generating thumbnail at ${tempLocalThumb}`);
    await new Promise((resolve, reject) => {
      ffmpeg(tempLocalFile)
        .on('end', () => {
           logger.info('[Thumbnail] FFmpeg processing finished.');
           resolve();
        })
        .on('error', (err, stdout, stderr) => {
          logger.error('[Thumbnail] FFmpeg error:', err.message);
          logger.error('[Thumbnail] FFmpeg stderr:', stderr);
          reject(new Error(`FFmpeg failed: ${err.message}`));
        })
        // Take screenshot at 1 second
        .screenshots({
          count: 1,
          timemarks: ['1'],
          filename: path.basename(tempLocalThumb),
          folder: path.dirname(tempLocalThumb),
          size: `${THUMBNAIL_MAX_WIDTH}x?` // Resize preserving aspect ratio
        });
    });
    logger.info(`[Thumbnail] Thumbnail generated: ${tempLocalThumb}`);

    // 3. Generate GIF preview using ffmpeg (best-effort)
    let gifPublicUrl;
    try {
      logger.info(`[GIF] Generating GIF at ${tempLocalGif}`);
      await new Promise((resolve, reject) => {
        ffmpeg(tempLocalFile)
          .on("end", () => {
            logger.info("[GIF] FFmpeg GIF processing finished.");
            resolve();
          })
          .on("error", (err, stdout, stderr) => {
            logger.error("[GIF] FFmpeg GIF error:", err.message);
            logger.error("[GIF] FFmpeg GIF stderr:", stderr);
            reject(new Error(`GIF FFmpeg failed: ${err.message}`));
          })
          .outputOptions([
            "-vf",
            `fps=10,scale=${GIF_MAX_WIDTH}:-1:flags=lanczos`,
          ])
          .toFormat("gif")
          .save(tempLocalGif);
      });

      logger.info(`[GIF] Uploading GIF to ${gifStoragePath}`);
      await thumbBucket.upload(tempLocalGif, {
        destination: gifStoragePath,
        metadata: {
          contentType: "image/gif",
        },
      });
      await thumbBucket.file(gifStoragePath).makePublic();
      gifPublicUrl = `https://storage.googleapis.com/${THUMBNAIL_BUCKET}/${gifStoragePath}`;
      logger.info(`[GIF] GIF public URL: ${gifPublicUrl}`);
    } catch (gifError) {
      // Don't fail the whole pipeline if GIF generation fails; thumbnail is primary.
      logger.error("[GIF] Failed to generate GIF preview:", gifError);
    }

    // 4. Upload thumbnail to Storage
    logger.info(`[Thumbnail] Uploading thumbnail to ${thumbStoragePath}`);
    await thumbBucket.upload(tempLocalThumb, {
      destination: thumbStoragePath,
      metadata: {
        contentType: 'image/jpeg',
        // Optional: Add cache control, etc.
      },
    });
    logger.info(`[Thumbnail] Thumbnail uploaded successfully.`);

    // 5. Make thumbnail public (or use signed URLs if preferred)
    await thumbBucket.file(thumbStoragePath).makePublic();

    // 6. Get public URLs
    const thumbnailPublicUrl = `https://storage.googleapis.com/${THUMBNAIL_BUCKET}/${thumbStoragePath}`;
    logger.info(`[Thumbnail] Thumbnail public URL: ${thumbnailPublicUrl}`);

    return {
      thumbnailUrl: thumbnailPublicUrl,
      gifUrl: gifPublicUrl,
    };

  } finally {
    // 6. Cleanup temporary files
    try {
      if (fs.existsSync(tempLocalFile)) fs.unlinkSync(tempLocalFile);
      if (fs.existsSync(tempLocalThumb)) fs.unlinkSync(tempLocalThumb);
      if (fs.existsSync(tempLocalGif)) fs.unlinkSync(tempLocalGif);
      logger.info('[Thumbnail] Cleaned up temporary files.');
    } catch (cleanupError) {
      logger.error('[Thumbnail] Error cleaning up temp files:', cleanupError);
    }
  }
}

// --- Cloud Function: Automatic Thumbnail Generation --- 
exports.generateThumbnailOnWrite = onDocumentWritten({
  document: "exerciseVideos/{exerciseVideoId}",
  region: "us-central1",
  runtime: "nodejs22"
}, async (event) => {
  const exerciseVideoId = event.params.exerciseVideoId;

  // Get data after the write
  const dataAfter = event.data?.after?.exists ? event.data.after.data() : null;
  // Get data before the write to check if thumbnail was just added
  const dataBefore = event.data?.before?.exists ? event.data.before.data() : null;

  // --- Exit conditions --- 
  // 1. Document was deleted
  if (!dataAfter) {
    logger.info(`[Thumbnail Trigger] Document ${exerciseVideoId} deleted. Skipping.`);
    // Optional: Delete the corresponding thumbnail from storage
    // try {
    //   const thumbStoragePath = `${THUMBNAIL_FOLDER}/${exerciseVideoId}${THUMBNAIL_SUFFIX}`;
    //   await storage.bucket(THUMBNAIL_BUCKET).file(thumbStoragePath).delete();
    //   logger.info(`[Thumbnail Trigger] Deleted thumbnail for ${exerciseVideoId}.`);
    // } catch (deleteError) {
    //   if (deleteError.code !== 404) { // Ignore 'not found' errors
    //     logger.error(`[Thumbnail Trigger] Failed to delete thumbnail for ${exerciseVideoId}:`, deleteError);
    //   }
    // }
    return null;
  }

  // 2. Video URL is missing (Let generateThumbnail handle specific format errors)
  if (!dataAfter.videoURL) {
    logger.info(`[Thumbnail Trigger] videoURL missing for ${exerciseVideoId}. Skipping.`);
    return null;
  }

  // 3. Thumbnail already exists
  if (dataAfter.thumbnail) {
    // Check if the *only* change was adding the thumbnail (prevents loop)
    const beforeThumbnail = dataBefore?.thumbnail;
    if (!beforeThumbnail) {
      logger.info(`[Thumbnail Trigger] Thumbnail was just added for ${exerciseVideoId}. Skipping.`);
      return null; 
    }
    // If thumbnail existed before AND after, no need to regenerate unless videoURL changed
    if (dataBefore?.thumbnail && dataBefore?.videoURL === dataAfter.videoURL) {
        logger.info(`[Thumbnail Trigger] Thumbnail exists and videoURL unchanged for ${exerciseVideoId}. Skipping.`);
        return null;
    }
    // Allow regeneration if videoURL changed but thumbnail didn't
    if (dataBefore?.videoURL !== dataAfter.videoURL) {
        logger.info(`[Thumbnail Trigger] videoURL changed for ${exerciseVideoId}. Proceeding to regenerate thumbnail.`);
    } else {
        logger.info(`[Thumbnail Trigger] Thumbnail exists for ${exerciseVideoId}. Skipping.`);
        return null;
    }
  }

  // --- Generate Thumbnail + GIF --- 
  try {
    const { thumbnailUrl, gifUrl } = await generateThumbnail(dataAfter.videoURL, exerciseVideoId);

    // Update Firestore document
    logger.info(`[Thumbnail Trigger] Updating Firestore for ${exerciseVideoId} with thumbnail${gifUrl ? " and GIF" : ""} URL(s).`);
    const updateData = {
      thumbnail: thumbnailUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp() // Update timestamp
    };
    if (gifUrl) {
      updateData.gifURL = gifUrl;
    }
    await db.collection('exerciseVideos').doc(exerciseVideoId).update(updateData);
    logger.info(`[Thumbnail Trigger] Firestore updated successfully for ${exerciseVideoId}.`);
    return null;

  } catch (error) {
    logger.error(`[Thumbnail Trigger] Failed to generate thumbnail for ${exerciseVideoId}:`, error);
    // Optional: Update Firestore document with an error status?
    // await db.collection('exerciseVideos').doc(exerciseVideoId).update({ thumbnailError: error.message });
    return null;
  }
});

// --- Cloud Function: Manual Thumbnail Generation Trigger (HTTPS) ---
// This function now queues tasks instead of processing directly.
exports.generateMissingThumbnails = onCall({
  region: "us-central1",
  runtime: "nodejs22"
}, async (request) => {
  // Optional: Add authentication/authorization check
  // if (!request.auth || !request.auth.token.admin) {
  //   throw new HttpsError('unauthenticated', 'Only administrators can trigger this function.');
  // }

  logger.info('[Manual Thumbnail Trigger] Starting queuing process.');
  const exerciseVideosRef = db.collection('exerciseVideos');
  let documentsToProcess = [];
  let checkedCount = 0;
  let skippedCount = 0; // Count videos skipped due to existing thumb or bad URL

  try {
    // Fetch all potentially relevant documents
    // Still fetches all, then filters locally before queuing to avoid complex queries
    logger.info('[Manual Thumbnail Trigger] Fetching all exercise video documents...');
    const snapshot = await exerciseVideosRef.get();
    checkedCount = snapshot.size;
    logger.info(`[Manual Thumbnail Trigger] Found ${checkedCount} total videos. Filtering...`);

    if (snapshot.empty) {
      logger.info('[Manual Thumbnail Trigger] No exercise videos found in the collection.');
      return { success: true, message: 'No videos found in collection.', queuedCount: 0, skippedCount: 0 };
    }

    // Filter documents that need processing
    snapshot.forEach(doc => {
      const videoData = doc.data();
      const exerciseVideoId = doc.id;

      const needsThumbnail = !videoData.thumbnail;
      const hasValidVideoUrl = videoData.videoURL &&
                               (videoData.videoURL.startsWith('gs://') ||
                                videoData.videoURL.startsWith('https://firebasestorage.googleapis.com'));

      if (needsThumbnail && hasValidVideoUrl) {
        documentsToProcess.push(exerciseVideoId);
      } else {
          skippedCount++;
          // Optional: Log why it was skipped if needed for debugging
          // if (skippedCount < 10) { // Log first few skips
          //   let reason = !needsThumbnail ? 'Thumbnail exists' : 'Invalid video URL';
          //   logger.debug(`[Manual Thumbnail Trigger] Skipping ${exerciseVideoId}: ${reason}`);
          // }
      }
    });

    const queueCount = documentsToProcess.length;
    if (queueCount === 0) {
      logger.info('[Manual Thumbnail Trigger] No videos needed processing after filtering.');
      return { success: true, message: 'All videos already have thumbnails or have invalid URLs.', queuedCount: 0, skippedCount };
    }

    logger.info(`[Manual Thumbnail Trigger] Queuing ${queueCount} videos for processing...`);

    // Publish a message for each document ID
    const publishPromises = documentsToProcess.map(videoId => {
      const messageBuffer = Buffer.from(JSON.stringify({ exerciseVideoId: videoId }));
      return pubSubClient.topic(TOPIC_NAME).publishMessage({ data: messageBuffer });
    });

    await Promise.all(publishPromises);

    const message = `Successfully queued ${queueCount} videos for thumbnail generation. ${skippedCount} videos were skipped (already processed or invalid URL).`;
    logger.info(message);
    return { success: true, message, queuedCount: queueCount, skippedCount };

  } catch (error) {
    logger.error('[Manual Thumbnail Trigger] Error during queuing process:', error);
    throw new HttpsError('internal', 'Failed to queue videos for thumbnail generation.', { queuedCount: 0, checkedCount, skippedCount });
  }
});

// --- Cloud Function: Process Thumbnail Queue (Pub/Sub Trigger) ---
// This function processes one video from the queue.
exports.processThumbnailQueue = onMessagePublished({
  topic: TOPIC_NAME,
  region: "us-central1",
  runtime: "nodejs22"
}, async (event) => {
  let exerciseVideoId;
  try {
    // Extract video ID from message payload
    const payload = event.data.message.json ? event.data.message.json : JSON.parse(Buffer.from(event.data.message.data, 'base64').toString());
    exerciseVideoId = payload.exerciseVideoId;

    if (!exerciseVideoId) {
      logger.error('[Thumbnail Processor] Received message without exerciseVideoId.', event.data.message.json);
      return null; // Acknowledge the message to prevent retries
    }

    logger.info(`[Thumbnail Processor] Received request for video ID: ${exerciseVideoId}`);

    // Fetch the document
    const docRef = db.collection('exerciseVideos').doc(exerciseVideoId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      logger.warn(`[Thumbnail Processor] Document ${exerciseVideoId} does not exist. Skipping.`);
      return null;
    }

    const videoData = docSnap.data();

    // Double-check if processing is still needed
    if (videoData.thumbnail) {
      logger.info(`[Thumbnail Processor] Thumbnail already exists for ${exerciseVideoId}. Skipping.`);
      return null;
    }

    if (!videoData.videoURL || !(videoData.videoURL.startsWith('gs://') || videoData.videoURL.startsWith('https://firebasestorage.googleapis.com'))) {
      logger.warn(`[Thumbnail Processor] Invalid or missing videoURL for ${exerciseVideoId}. Skipping.`);
      // Optional: Update Firestore with an error status?
      // await docRef.update({ thumbnailError: 'Invalid video URL' });
      return null;
    }

    // Generate the thumbnail (and GIF)
    logger.info(`[Thumbnail Processor] Generating thumbnail (and GIF) for ${exerciseVideoId}...`);
    const { thumbnailUrl, gifUrl } = await generateThumbnail(videoData.videoURL, exerciseVideoId);

    // Update Firestore document
    const updateData = {
      thumbnail: thumbnailUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      thumbnailError: admin.firestore.FieldValue.delete() // Remove previous error if any
    };
    if (gifUrl) {
      updateData.gifURL = gifUrl;
    }
    await docRef.update(updateData);

    logger.info(`[Thumbnail Processor] Successfully processed ${exerciseVideoId}. Thumbnail URL${gifUrl ? " and GIF URL" : ""} added.`);
    return null;

  } catch (error) {
    logger.error(`[Thumbnail Processor] Failed to process video ID ${exerciseVideoId}:`, error);
    // Optional: Update Firestore document with an error status to prevent retries on permanent errors
    if (exerciseVideoId) { // Only update if we have an ID
        try {
            await db.collection('exerciseVideos').doc(exerciseVideoId).update({
                thumbnailError: error.message || 'Processing failed',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (updateError) {
            logger.error(`[Thumbnail Processor] Failed to update error status for ${exerciseVideoId}:`, updateError);
        }
    }
    // Depending on the error, you might want to throw it to trigger Pub/Sub retries
    // or return null to acknowledge and stop retries (e.g., for invalid URL errors).
    // For now, returning null to prevent infinite retries on persistent errors.
    return null;
  }
}); 

// --- Cloud Function (callable): Manually (re)generate thumbnail & GIF for a single ExerciseVideo ---
exports.generateGifForExerciseVideo = onCall({
  region: "us-central1",
  runtime: "nodejs22"
}, async (request) => {
  const videoId = request?.data?.videoId;

  if (!videoId || typeof videoId !== 'string') {
    throw new HttpsError('invalid-argument', 'A valid videoId string is required.');
  }

  logger.info(`[Manual GIF] Requested GIF generation for video ID: ${videoId}`);

  const docRef = db.collection('exerciseVideos').doc(videoId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new HttpsError('not-found', `ExerciseVideo document ${videoId} not found.`);
  }

  const videoData = docSnap.data();

  if (!videoData.videoURL || !(videoData.videoURL.startsWith('gs://') || videoData.videoURL.startsWith('https://firebasestorage.googleapis.com'))) {
    throw new HttpsError('failed-precondition', 'Video document is missing a supported videoURL (gs:// or https://firebasestorage.googleapis.com).');
  }

  try {
    logger.info(`[Manual GIF] Generating thumbnail/GIF for ${videoId}...`);
    const { thumbnailUrl, gifUrl } = await generateThumbnail(videoData.videoURL, videoId);

    const updateData = {
      thumbnail: thumbnailUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (gifUrl) {
      updateData.gifURL = gifUrl;
    }

    await docRef.update(updateData);

    logger.info(`[Manual GIF] Successfully updated ${videoId} with thumbnail${gifUrl ? ' and GIF' : ''} URL(s).`);

    return {
      success: true,
      thumbnailUrl,
      gifUrl: gifUrl || null
    };
  } catch (error) {
    logger.error(`[Manual GIF] Failed to generate GIF for ${videoId}:`, error);
    throw new HttpsError('internal', 'Failed to generate GIF for this video.', {
      message: error?.message || String(error)
    });
  }
});

// --- Cloud Function (HTTP with CORS): Manually (re)generate thumbnail & GIF for a single ExerciseVideo ---
exports.generateGifForExerciseVideoHttp = onRequest({
  region: "us-central1",
  runtime: "nodejs22",
  // Let the v2 HTTPS layer handle CORS for these origins, including preflight.
  cors: ["http://localhost:8888", "https://fitwithpulse.ai"],
}, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }

  try {
    const { videoId } = req.body || {};

    if (!videoId || typeof videoId !== 'string') {
      logger.warn('[Manual GIF HTTP] Missing or invalid videoId in request body:', req.body);
      return res.status(400).json({ success: false, message: 'A valid videoId string is required.' });
    }

    logger.info(`[Manual GIF HTTP] Requested GIF generation for video ID: ${videoId}`);

    const docRef = db.collection('exerciseVideos').doc(videoId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      logger.warn(`[Manual GIF HTTP] ExerciseVideo document ${videoId} not found.`);
      return res.status(404).json({ success: false, message: `ExerciseVideo document ${videoId} not found.` });
    }

    const videoData = docSnap.data();

    if (
      !videoData.videoURL ||
      !(videoData.videoURL.startsWith('gs://') ||
        videoData.videoURL.startsWith('https://firebasestorage.googleapis.com'))
    ) {
      logger.warn(`[Manual GIF HTTP] Invalid or missing videoURL for ${videoId}:`, videoData.videoURL);
      return res.status(400).json({
        success: false,
        message: 'Video document is missing a supported videoURL (gs:// or https://firebasestorage.googleapis.com).',
      });
    }

    logger.info(`[Manual GIF HTTP] Generating thumbnail/GIF for ${videoId} using videoURL ${videoData.videoURL}...`);
    const { thumbnailUrl, gifUrl } = await generateThumbnail(videoData.videoURL, videoId);

    const updateData = {
      thumbnail: thumbnailUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (gifUrl) {
      updateData.gifURL = gifUrl;
    }

    await docRef.update(updateData);

    logger.info(
      `[Manual GIF HTTP] Successfully updated ${videoId} with thumbnail${gifUrl ? ' and GIF' : ''} URL(s).`
    );

    return res.status(200).json({
      success: true,
      thumbnailUrl,
      gifUrl: gifUrl || null,
    });
  } catch (error) {
    logger.error('[Manual GIF HTTP] Failed to generate GIF:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate GIF for this video.',
      error: error?.message || String(error),
    });
  }
});

// --- Cloud Function (callable): Normalize an ExerciseVideo's backing file name to .mp4 and update URLs ---
exports.normalizeExerciseVideoToMp4 = onCall({
  region: "us-central1",
  runtime: "nodejs22",
}, async (request) => {
  const videoId = request?.data?.videoId;

  if (!videoId || typeof videoId !== "string") {
    throw new HttpsError("invalid-argument", "A valid videoId string is required.");
  }

  logger.info(`[NormalizeToMp4] Requested normalization for video ID: ${videoId}`);

  const docRef = db.collection("exerciseVideos").doc(videoId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new HttpsError("not-found", `ExerciseVideo document ${videoId} not found.`);
  }

  const videoData = docSnap.data() || {};

  const rawPath =
    videoData.originalVideoStoragePath ||
    videoData.originalVideoUrl ||
    videoData.videoURL;

  if (!rawPath || typeof rawPath !== "string") {
    throw new HttpsError(
      "failed-precondition",
      "No storage path or videoURL found on ExerciseVideo document."
    );
  }

  // Reuse the same parsing logic style as generateThumbnail
  let bucketName;
  let filePath;

  try {
    if (rawPath.startsWith("gs://")) {
      bucketName = rawPath.split("/")[2];
      filePath = rawPath.split("/").slice(3).join("/");
    } else if (rawPath.startsWith("https://firebasestorage.googleapis.com")) {
      const urlParts = rawPath.split("/");
      const bucketIndex = urlParts.findIndex((part) => part === "b") + 1;
      const pathIndex = urlParts.findIndex((part) => part === "o") + 1;
      if (bucketIndex > 0 && pathIndex > 0 && pathIndex > bucketIndex) {
        bucketName = urlParts[bucketIndex];
        filePath = decodeURIComponent(
          urlParts
            .slice(pathIndex)
            .join("/")
            .split("?")[0]
        );
      } else {
        throw new Error(`Could not parse HTTPS URL format: ${rawPath}`);
      }
    } else {
      throw new Error(
        `Invalid or unsupported storage path format: ${rawPath}. Must start with gs:// or https://firebasestorage.googleapis.com`
      );
    }
  } catch (e) {
    logger.error("[NormalizeToMp4] Failed to parse storage path:", rawPath, e);
    throw new HttpsError(
      "invalid-argument",
      `Could not parse storage location from path: ${rawPath}`
    );
  }

  if (!bucketName || !filePath) {
    throw new HttpsError(
      "invalid-argument",
      `Failed to extract bucket or file path from: ${rawPath}`
    );
  }

  logger.info("[NormalizeToMp4] Parsed storage location", {
    bucketName,
    filePath,
  });

  // If it already looks like an .mp4, just confirm URLs and return.
  if (/\.mp4$/i.test(filePath)) {
    const publicUrl = videoData.videoURL || rawPath;
    logger.info(
      "[NormalizeToMp4] File already appears to be .mp4, no rename needed.",
      { bucketName, filePath, publicUrl }
    );
    return {
      success: true,
      videoURL: publicUrl,
      storagePath: `gs://${bucketName}/${filePath}`,
      alreadyMp4: true,
    };
  }

  // Build new path with .mp4 extension
  const newFilePath = filePath.replace(/\.[^/.]+$/, ".mp4");
  const bucket = storage.bucket(bucketName);
  const sourceFile = bucket.file(filePath);
  const destFile = bucket.file(newFilePath);

  logger.info("[NormalizeToMp4] Copying file to new .mp4 path", {
    from: filePath,
    to: newFilePath,
  });

  try {
    await sourceFile.copy(destFile);
    // Best-effort: ensure metadata advertises MP4
    try {
      await destFile.setMetadata({ contentType: "video/mp4" });
    } catch (metaError) {
      logger.warn("[NormalizeToMp4] Failed to set metadata on new mp4 file:", metaError);
    }
  } catch (copyError) {
    logger.error("[NormalizeToMp4] Failed to copy file to mp4 path:", copyError);
    throw new HttpsError(
      "internal",
      "Failed to create .mp4 copy of the video file.",
      { message: copyError?.message || String(copyError) }
    );
  }

  // Best-effort: delete old file, but don't fail normalization if this delete fails
  try {
    await sourceFile.delete();
    logger.info("[NormalizeToMp4] Deleted original file after successful copy.");
  } catch (deleteError) {
    logger.warn("[NormalizeToMp4] Failed to delete original file:", deleteError);
  }

  const newGsPath = `gs://${bucketName}/${newFilePath}`;
  const newPublicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    newFilePath
  )}?alt=media`;

  const updateData = {
    videoURL: newPublicUrl,
    originalVideoStoragePath: newGsPath,
    originalVideoUrl: newPublicUrl,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  logger.info("[NormalizeToMp4] Updating ExerciseVideo document with new paths", {
    videoId,
    updateData,
  });

  await docRef.update(updateData);

  return {
    success: true,
    videoURL: newPublicUrl,
    storagePath: newGsPath,
    alreadyMp4: false,
  };
});