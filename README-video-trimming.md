# Video Trimming Solution for QuickLifts

## Overview

This document describes the video trimming implementation for QuickLifts. We've implemented a client-side solution that avoids the need for cross-origin isolation (COOP/COEP headers) which would break Apple Sign-In and other third-party integrations.

## How It Works

1. **Client-Side Selection**: Users select trim points on their videos in the browser
2. **Metadata-Based Approach**: Instead of actually trimming the video in the browser (which would require cross-origin isolation for FFmpeg), we store the trim points as metadata
3. **Server-Side Processing**: The full video is uploaded with trim metadata, and server-side processing completes the actual trimming

## Implementation Details

### Client-Side Components

- `SimpleVideoTrimmer.tsx`: A component that allows users to select start and end points for their video without requiring cross-origin isolation
- Uses native browser video capabilities instead of FFmpeg
- Stores trim metadata in the video file object and filename

### Data Flow

1. User uploads a video in `Create.tsx`
2. Video is stored in IndexedDB (to avoid sessionStorage quota errors)
3. User is directed to `trim-video.tsx` page where they can select trim points
4. Trim metadata is attached to the video file
5. On return to `Create.tsx`, the full video is uploaded to Firebase Storage with trim metadata
6. Trim metadata is stored in the Firestore document for server-side processing

## Server-Side Implementation (Required)

To complete the video trimming functionality, you need to implement server-side processing:

### Option 1: Firebase Cloud Function

Create a Firebase Cloud Function that:

1. Triggers on creation of a new exercise video document in Firestore
2. Checks for `trimMetadata` field in the document
3. If present, downloads the original video from Firebase Storage
4. Uses FFmpeg to trim the video based on the metadata
5. Uploads the trimmed version back to Firebase Storage
6. Updates the Firestore document with the new trimmed video URL

Example Cloud Function (Node.js with FFmpeg):

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const os = require('os');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

admin.initializeApp();
const storage = new Storage();
const db = admin.firestore();

exports.processVideoTrim = functions.firestore
  .document('exerciseVideos/{videoId}')
  .onCreate(async (snap, context) => {
    const videoData = snap.data();
    
    // Check if this video has trim metadata
    if (!videoData.trimMetadata) {
      console.log('No trim metadata found, skipping processing');
      return null;
    }
    
    const { trimStart, trimEnd } = videoData.trimMetadata;
    const duration = trimEnd - trimStart;
    
    console.log(`Processing video trim: ${trimStart}s to ${trimEnd}s (duration: ${duration}s)`);
    
    // Get the original video file
    const tempFilePath = path.join(os.tmpdir(), 'original_video.mp4');
    const trimmedFilePath = path.join(os.tmpdir(), 'trimmed_video.mp4');
    
    const storagePath = videoData.storagePath;
    const bucketName = storagePath.split('/')[2]; // Assuming format: gs://bucket-name/path/to/file
    const filePath = storagePath.split('/').slice(3).join('/');
    
    // Download the file
    await storage.bucket(bucketName).file(filePath).download({
      destination: tempFilePath
    });
    
    // Process the video using FFmpeg
    return new Promise((resolve, reject) => {
      ffmpeg(tempFilePath)
        .setStartTime(trimStart)
        .setDuration(duration)
        .output(trimmedFilePath)
        .on('end', async () => {
          try {
            // Upload the trimmed video
            const trimmedStoragePath = `${filePath.split('.')[0]}_trimmed.mp4`;
            await storage.bucket(bucketName).upload(trimmedFilePath, {
              destination: trimmedStoragePath
            });
            
            // Get download URL
            const [file] = await storage.bucket(bucketName).file(trimmedStoragePath).getSignedUrl({
              action: 'read',
              expires: '03-01-2500' // Far future expiration
            });
            
            // Update the Firestore document
            await db.collection('exerciseVideos').doc(context.params.videoId).update({
              trimmedVideoURL: file,
              trimmedStoragePath: `gs://${bucketName}/${trimmedStoragePath}`,
              isProcessed: true
            });
            
            // Clean up temporary files
            fs.unlinkSync(tempFilePath);
            fs.unlinkSync(trimmedFilePath);
            
            console.log('Video trimming completed successfully');
            resolve();
          } catch (error) {
            console.error('Error in final processing:', error);
            reject(error);
          }
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .run();
    });
  });
```

### Option 2: Batch Processing Script

If you prefer to avoid the costs of Cloud Functions, you can create a batch processing script that runs on a schedule:

1. Create a script that queries Firestore for unprocessed videos with trim metadata
2. Process them using FFmpeg
3. Run this script periodically using a cron job

## Testing

To test the implementation:

1. Upload a video in the Create screen
2. Set trim points in the Trim Video screen
3. Complete the upload process
4. Check the Firestore document to verify trim metadata is correctly stored
5. Implement and test the server-side processing to verify the trimmed video is created correctly

## Conclusion

This solution allows video trimming functionality without requiring cross-origin isolation on the client side, preserving compatibility with Apple Sign-In and other third-party services. 